// Video extraction service using yt-dlp

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type {
  VideoInfoResponse,
  VideoQuality,
  VideoMetadata,
  AudioOnly,
  Platform,
} from "@/lib/types";
import { detectPlatform, isPlatformSupported } from "@/lib/utils/platform";
import { parseYtDlpError, ExtractionError } from "@/lib/utils/errors";
import { buildYtDlpCommand, escapePath, getYtDlpCommand } from "@/lib/utils/command";

const execAsync = promisify(exec);

// Temporary directory for downloads
const TEMP_DIR = path.join(os.tmpdir(), "grablink-downloads");

// Simple in-memory cache for video info (reduces redundant API calls)
// Cache expires after 5 minutes to balance performance and freshness
interface CacheEntry {
  data: VideoInfoResponse;
  timestamp: number;
}

const videoInfoCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(url: string): string {
  // Normalize URL for cache key (remove trailing slashes, lowercase)
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

function getCachedInfo(url: string): VideoInfoResponse | null {
  const key = getCacheKey(url);
  const entry = videoInfoCache.get(key);
  
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    console.log("[getVideoInfo] Cache hit for URL:", url);
    return entry.data;
  }
  
  if (entry) {
    // Expired entry, remove it
    videoInfoCache.delete(key);
  }
  
  return null;
}

function setCachedInfo(url: string, data: VideoInfoResponse): void {
  const key = getCacheKey(url);
  videoInfoCache.set(key, {
    data,
    timestamp: Date.now(),
  });
  
  // Limit cache size to prevent memory issues (keep last 100 entries)
  if (videoInfoCache.size > 100) {
    const oldestKey = Array.from(videoInfoCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
    videoInfoCache.delete(oldestKey);
  }
}

// Sleep helper for retries
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry helper for TikTok with exponential backoff - optimized for speed
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1500, // Reduced from 2000 to 1500 for faster retries
  isTikTok: boolean = false
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add random sleep before TikTok requests to avoid rate limiting
      // Reduced delays for faster retries
      if (isTikTok && attempt > 0) {
        const delay = initialDelay * Math.pow(1.8, attempt - 1) + Math.random() * 500; // Reduced exponential base and random delay
        console.log(`[retryWithBackoff] TikTok retry ${attempt + 1}/${maxRetries}, waiting ${Math.round(delay)}ms`);
        await sleep(delay);
      } else if (!isTikTok && attempt > 0) {
        // Faster retries for non-TikTok platforms
        const delay = initialDelay * attempt; // Linear backoff for non-TikTok (faster)
        await sleep(delay);
      }
      
      return await fn();
    } catch (error) {
      lastError = error;
      // Only log on last attempt to reduce noise
      if (attempt === maxRetries - 1) {
        console.log(`[retryWithBackoff] All ${maxRetries} attempts failed:`, error instanceof Error ? error.message : error);
      }
      
      if (attempt === maxRetries - 1) {
        throw lastError;
      }
    }
  }
  
  throw lastError;
}

// Ensure temp directory exists
async function ensureTempDir(): Promise<void> {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new ExtractionError(
      `Failed to create temporary directory: ${errorMessage}`,
      "TEMP_DIR_ERROR",
      { path: TEMP_DIR }
    );
  }
}

/**
 * Get video info using yt-dlp
 * Optimized with caching to reduce redundant API calls
 */
export async function getVideoInfo(url: string): Promise<VideoInfoResponse> {
  // Check cache first (fast path)
  const cached = getCachedInfo(url);
  if (cached) {
    return cached;
  }
  
  const platform = detectPlatform(url);
  console.log("[getVideoInfo] Detected platform:", platform, "URL:", url);
  console.log("[getVideoInfo] Is platform supported:", isPlatformSupported(platform));

  if (!isPlatformSupported(platform)) {
    const errorResponse: VideoInfoResponse = {
      success: false,
      platform,
      url,
      qualities: [],
      downloadOptions: {
        recommendedMethod: "proxy",
        supportsDirect: false,
        supportsStreaming: true,
      },
      error: {
        code: "PLATFORM_NOT_SUPPORTED",
        message: `Platform "${platform}" is not supported. Supported platforms: TikTok, Instagram, YouTube, Twitter, Facebook, Pinterest, Vimeo, Twitch, and Reddit.`,
      },
    };
    return errorResponse;
  }

  try {
    await ensureTempDir();

    // Normalize URL
    let finalUrl = url.trim();
    
    // Ensure URL has proper protocol
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }
    
    // Remove trailing slash if present
    finalUrl = finalUrl.replace(/\/+$/, "");
    
    // Ensure URL doesn't have double slashes in path (except after protocol)
    finalUrl = finalUrl.replace(/([^:]\/)\/+/g, "$1");

    // Get the yt-dlp command to use (getYtDlpCommand() already tests all available methods)
    const ytDlpCmd = await getYtDlpCommand();
    const isTikTok = platform === "tiktok";
    console.log("[getVideoInfo] Detected yt-dlp command:", ytDlpCmd, "isTikTok:", isTikTok);
    
    // If the default is still "yt-dlp" and it's not working, it means yt-dlp isn't installed
    // But getYtDlpCommand() should have tried python3 -m yt_dlp first, so if we get here
    // with "yt-dlp", it means that's what was detected. We'll proceed and let the actual
    // command execution handle the error if it fails.

    // Use yt-dlp to get video info (JSON format) with proper URL escaping
    const command = await buildYtDlpCommand(finalUrl, {
      json: true,
      noDownload: true,
    });
    
    console.log("[getVideoInfo] Executing command:", command.substring(0, 200) + "...");
    
    let stdout: string = "";
    let stderr: string = "";
    let execError: any = null;
    
    // For TikTok, use retry logic with backoff
    // Optimized timeouts: faster for non-TikTok platforms
    const executeCommand = async () => {
      const result = await execAsync(command, {
        timeout: isTikTok ? 180000 : 90000, // 3 minutes for TikTok, 90s for others (reduced from 120s)
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      return result;
    };
    
    try {
      const result = isTikTok
        ? await retryWithBackoff(executeCommand, 3, 2000, true)
        : await executeCommand();
      stdout = result.stdout;
      stderr = result.stderr || "";
      console.log("[getVideoInfo] Command executed successfully, stdout length:", stdout.length);
    } catch (error: any) {
      execError = error;
      console.error("[getVideoInfo] Command execution failed:", error);
      console.error("[getVideoInfo] Error code:", error.code);
      console.error("[getVideoInfo] Error signal:", error.signal);
      console.error("[getVideoInfo] stderr:", error.stderr?.substring(0, 1000));
      console.error("[getVideoInfo] stdout:", error.stdout?.substring(0, 1000));
      
      // Handle timeout
      if (error.code === "ETIMEDOUT" || error.signal === "SIGTERM") {
        return {
          success: false,
          platform,
          url,
          qualities: [],
          downloadOptions: {
            recommendedMethod: "proxy",
            supportsDirect: false,
            supportsStreaming: true,
          },
          error: {
            code: "TIMEOUT",
            message: "Request timed out - the server took too long to respond",
          },
        };
      }


      // If we still have an error after fallback attempts, return error
      if (execError) {
        // Pass the full error object to parseYtDlpError so it can check error codes
        const parsedError = parseYtDlpError(execError);
        
        return {
          success: false,
          platform,
          url,
          qualities: [],
          downloadOptions: {
            recommendedMethod: "proxy",
            supportsDirect: false,
            supportsStreaming: true,
          },
          error: parsedError,
        };
      }
    }

    // Check for errors in stderr (warnings and non-critical errors are okay)
    const stderrLower = stderr.toLowerCase();
    
    const isError = stderr && 
      !stderrLower.includes("warning") && 
      !stderrLower.includes("downloading") && 
      !stderrLower.includes("100%");
    
    if (isError) {
      console.warn("[getVideoInfo] stderr contains potential errors:", stderr);
      const parsedError = parseYtDlpError(stderr);
      return {
        success: false,
        platform,
        url,
        qualities: [],
        downloadOptions: {
          recommendedMethod: "proxy",
          supportsDirect: false,
          supportsStreaming: true,
        },
        error: parsedError,
      };
    }

    // Parse JSON output
    let videoData: any;
    try {
      if (!stdout || stdout.trim().length === 0) {
        throw new Error("Empty stdout from yt-dlp");
      }
      
      // Try to extract JSON from stdout (sometimes there's extra text before/after)
      let jsonStart = stdout.indexOf('{');
      let jsonEnd = stdout.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
        videoData = JSON.parse(jsonStr);
      } else {
        videoData = JSON.parse(stdout);
      }
      
      console.log("[getVideoInfo] Successfully parsed video data, title:", videoData.title);
    } catch (parseError) {
      console.error("[getVideoInfo] Failed to parse JSON:", parseError);
      console.error("[getVideoInfo] stdout length:", stdout?.length || 0);
      console.error("[getVideoInfo] stdout content (first 1000 chars):", stdout?.substring(0, 1000) || "empty");
      
      return {
        success: false,
        platform,
        url,
        qualities: [],
        downloadOptions: {
          recommendedMethod: "proxy",
          supportsDirect: false,
          supportsStreaming: true,
        },
        error: {
          code: "PARSE_ERROR",
          message: "Failed to parse video information from server response",
        },
      };
    }

    // Validate video data
    if (!videoData || typeof videoData !== "object") {
      return {
        success: false,
        platform,
        url,
        qualities: [],
        downloadOptions: {
          recommendedMethod: "proxy",
          supportsDirect: false,
          supportsStreaming: true,
        },
        error: {
          code: "INVALID_RESPONSE",
          message: "Invalid video data received from server",
        },
      };
    }

    // Extract metadata
    const metadata: VideoMetadata = {
      title: videoData.title || "Untitled",
      author: {
        username: videoData.uploader_id || videoData.uploader || "Unknown",
        displayName: videoData.uploader || videoData.uploader_id || "Unknown",
        avatar: videoData.thumbnail || undefined,
      },
      description: videoData.description || undefined,
      thumbnail: videoData.thumbnail || videoData.thumbnails?.[0]?.url || undefined,
      duration: videoData.duration || undefined,
      views: videoData.view_count || undefined,
      likes: videoData.like_count || undefined,
      date: videoData.upload_date
        ? `${videoData.upload_date.slice(0, 4)}-${videoData.upload_date.slice(4, 6)}-${videoData.upload_date.slice(6, 8)}`
        : undefined,
      hasWatermark: platform === "instagram",
    };

    // Extract available formats/qualities
    const formats = videoData.formats || [];
    const qualities: VideoQuality[] = [];

    // Get base file size from videoData if formats don't have it
    const baseFileSize = videoData.filesize || videoData.filesize_approx || 0;
    console.log(`[getVideoInfo] Platform: ${platform}, Base file size: ${baseFileSize}, Formats count: ${formats.length}`);

    // Group formats by quality
    const qualityMap = new Map<string, VideoQuality>();

    for (const format of formats) {
      if (!format.vcodec || format.vcodec === "none") continue; // Skip audio-only formats

      const quality = format.height
        ? `${format.height}p`
        : format.quality_label || format.format_note || "unknown";
      const formatExt = format.ext || "mp4";
      // Try to get size from format, fallback to base size, or estimate from duration/bitrate
      let fileSize = format.filesize || format.filesize_approx || 0;
      
      // If no size in format, try base size
      if (fileSize === 0 && baseFileSize > 0) {
        fileSize = baseFileSize;
      }
      
      // If still no size, try to estimate from duration and bitrate
      if (fileSize === 0 && videoData.duration && format.tbr) {
        // Estimate: duration (seconds) * bitrate (bits/sec) / 8 = bytes
        fileSize = Math.round((videoData.duration * format.tbr * 1000) / 8);
      }
      
      // Note: We don't apply size reduction here because:
      // 1. The actual download might fall back to "best" quality if 720p isn't available
      // 2. Different codecs/bitrates can result in very different file sizes
      // 3. The estimate should reflect the original format size, and we'll show it as "estimated"
      // The actual file size will be shown after download

      // Prefer best quality for each resolution
      if (!qualityMap.has(quality) || (qualityMap.get(quality)?.size || 0) < fileSize) {
        qualityMap.set(quality, {
          quality,
          format: formatExt,
          size: fileSize,
          url: format.url || "",
          method: "proxy", // Most platforms require proxy
          requiresProxy: true,
        });
      }
    }

    // Convert map to array
    qualities.push(...Array.from(qualityMap.values()));
    
    // If no formats found but we have base file size, create a default quality entry
    if (qualities.length === 0 && baseFileSize > 0) {
      // Use base file size as estimate (actual size may vary)
      qualities.push({
        quality: "720p",
        format: videoData.ext || "mp4",
        size: baseFileSize, // Use original size estimate (will be shown as "estimated")
        url: videoData.url || "",
        method: "proxy",
        requiresProxy: true,
      });
    }
    
    // Sort by quality
    qualities.sort((a, b) => {
      const aNum = parseInt(a.quality) || 0;
      const bNum = parseInt(b.quality) || 0;
      return bNum - aNum;
    });

    // Extract audio-only option
    let audioOnly: AudioOnly | undefined;
    const audioFormats = formats.filter((f: any) => f.vcodec === "none" && f.acodec !== "none");
    if (audioFormats.length > 0) {
      const bestAudio = audioFormats.reduce((best: any, current: any) => {
        const currentSize = current.filesize || current.filesize_approx || 0;
        const bestSize = best.filesize || best.filesize_approx || 0;
        return currentSize > bestSize ? current : best;
      });
      
      let audioSize = bestAudio.filesize || bestAudio.filesize_approx || 0;
      
      // If no audio size, estimate from duration and audio bitrate
      if (audioSize === 0 && videoData.duration && bestAudio.tbr) {
        audioSize = Math.round((videoData.duration * bestAudio.tbr * 1000) / 8);
      }
      // If still no size, estimate as ~10% of video size
      else if (audioSize === 0 && baseFileSize > 0) {
        audioSize = Math.round(baseFileSize * 0.1);
      }
      
      audioOnly = {
        format: bestAudio.ext || "mp3",
        size: audioSize,
        url: bestAudio.url || "",
        method: "proxy",
      };
    } else if (baseFileSize > 0) {
      // If no audio format found but we have video size, estimate audio size
      audioOnly = {
        format: "mp3",
        size: Math.round(baseFileSize * 0.1), // Estimate audio as ~10% of video
        url: "",
        method: "proxy",
      };
    }

    const successResponse: VideoInfoResponse = {
      success: true,
      platform,
      url,
      metadata,
      qualities,
      audioOnly,
      downloadOptions: {
        recommendedMethod: "proxy",
        supportsDirect: false,
        supportsStreaming: true,
      },
    };
    
    // Cache successful response
    setCachedInfo(url, successResponse);
    
    return successResponse;
  } catch (error) {
    // Handle ExtractionError
    if (error instanceof ExtractionError) {
      return {
        success: false,
        platform,
        url,
        qualities: [],
        downloadOptions: {
          recommendedMethod: "proxy",
          supportsDirect: false,
          supportsStreaming: true,
        },
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      platform,
      url,
      qualities: [],
      downloadOptions: {
        recommendedMethod: "proxy",
        supportsDirect: false,
        supportsStreaming: true,
      },
      error: {
        code: "EXTRACTION_FAILED",
        message: `Failed to extract video info: ${errorMessage}`,
      },
    };
  }
}

/**
 * Download video using yt-dlp
 */
export async function downloadVideo(
  url: string,
  quality?: string,
  outputPath?: string,
  downloadId?: string
): Promise<{ filePath: string; metadata: any }> {
  const platform = detectPlatform(url);
  console.log("[downloadVideo] Detected platform:", platform, "URL:", url);
  console.log("[downloadVideo] Is platform supported:", isPlatformSupported(platform));
  
  if (!isPlatformSupported(platform)) {
    throw new ExtractionError(
      `Platform "${platform}" is not supported. Supported platforms: TikTok, Instagram, YouTube, Twitter, Facebook, Pinterest, Vimeo, Twitch, and Reddit.`,
      "PLATFORM_NOT_SUPPORTED",
      { platform, url }
    );
  }

  try {
    await ensureTempDir();
  } catch (error) {
    if (error instanceof ExtractionError) {
      throw error;
    }
    throw new ExtractionError(
      "Failed to create temporary directory",
      "TEMP_DIR_ERROR"
    );
  }

  // Use downloadId in filename if provided for reliable tracking
  // Otherwise fall back to timestamp
  const filePrefix = downloadId ? downloadId.replace(/[^a-z0-9_]/gi, '_') : `video_${Date.now()}`;
  const outputFile = outputPath || path.join(TEMP_DIR, `${filePrefix}.%(ext)s`);
  
  console.log("[downloadVideo] Starting download - downloadId:", downloadId, "filePrefix:", filePrefix, "outputFile:", outputFile);
  console.log("[downloadVideo] Temp directory:", TEMP_DIR);
  
  // Record start time to find files created after this point
  const downloadStartTime = Date.now();
  
  // Smart URL normalization - handle various URL formats
  let finalDownloadUrl = url.trim();
  
  // Remove any whitespace
  finalDownloadUrl = finalDownloadUrl.trim();
  
  // If URL doesn't start with http:// or https://, try to add it
  if (!finalDownloadUrl.match(/^https?:\/\//i)) {
    // Check if it looks like a URL (has a domain)
    if (finalDownloadUrl.includes(".") && !finalDownloadUrl.includes(" ")) {
      finalDownloadUrl = "https://" + finalDownloadUrl;
    } else {
      throw new ExtractionError(
        `Invalid URL format: "${url}". Please provide a valid URL starting with http:// or https://`,
        "INVALID_URL",
        { url }
      );
    }
  }
  
  // Normalize URL - remove trailing slashes and fix double slashes
  finalDownloadUrl = finalDownloadUrl.replace(/\/+$/, ""); // Remove trailing slashes
  finalDownloadUrl = finalDownloadUrl.replace(/([^:]\/)\/+/g, "$1"); // Fix double slashes (but not in protocol)
  
  // Validate the URL is actually valid
  try {
    new URL(finalDownloadUrl);
  } catch {
    throw new ExtractionError(
      `Invalid URL format: "${url}". Could not parse as a valid URL.`,
      "INVALID_URL",
      { url, normalized: finalDownloadUrl }
    );
  }

  const isTikTok = platform === "tiktok";

  // Download video in best available quality
  // Removed 720p limit to ensure all videos download regardless of size
  // Format includes /best fallback for maximum compatibility
  const command = await buildYtDlpCommand(finalDownloadUrl, {
    format: "best", // Use best available quality (no height restriction) to ensure all videos download
    output: outputFile,
  });
  
  console.log("[downloadVideo] Executing command:", command.substring(0, 200) + "...");

  let stdout: string;
  let stderr: string;

  // For TikTok, use retry logic with backoff
  // Optimized: faster retries, better error handling
  const executeCommand = async () => {
    const result = await execAsync(command, {
      timeout: isTikTok ? 900000 : 600000, // 15 minutes for TikTok, 10 minutes for others (reduced from 15)
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer
    });
    return result;
  };

  try {
    const result = isTikTok
      ? await retryWithBackoff(executeCommand, 3, 3000, true)
      : await executeCommand();
    stdout = result.stdout;
    stderr = result.stderr || "";
    console.log("[downloadVideo] Command executed successfully, stdout length:", stdout.length);
  } catch (execError: any) {
    console.error("[downloadVideo] Command execution failed:", execError);
    console.error("[downloadVideo] stderr:", execError.stderr?.substring(0, 500));
    console.error("[downloadVideo] stdout:", execError.stdout?.substring(0, 500));
    
    // Handle timeout
    if (execError.code === "ETIMEDOUT" || execError.signal === "SIGTERM") {
      throw new ExtractionError(
        "Download timed out - the server took too long to respond",
        "TIMEOUT",
        { url, quality }
      );
    }

    // Check if it's a format/quality error - try again with best quality as fallback
    const errorOutput = execError.stderr || execError.stdout || execError.message || "";
    const errorLower = errorOutput.toLowerCase();
    
    if (errorLower.includes("format") || errorLower.includes("quality") || errorLower.includes("requested format")) {
      console.log("[downloadVideo] Format error detected, retrying with best quality fallback");
      // Retry with best quality (no restrictions) - this should work for all videos
      const fallbackCommand = await buildYtDlpCommand(url, {
        format: "bestvideo+bestaudio/best", // Try best video+audio combo, fallback to best single file
        output: outputFile,
      });
      
      try {
        console.log("[downloadVideo] Retrying with fallback command:", fallbackCommand.substring(0, 200) + "...");
        const fallbackResult = await execAsync(fallbackCommand, {
          timeout: 900000, // 15 minutes timeout
          maxBuffer: 100 * 1024 * 1024, // 100MB buffer
        });
        stdout = fallbackResult.stdout;
        stderr = fallbackResult.stderr || "";
        console.log("[downloadVideo] Fallback command succeeded");
      } catch (fallbackError: any) {
        // If fallback also fails, parse and throw the original error
        const parsedError = parseYtDlpError(execError);
        throw new ExtractionError(parsedError.message, parsedError.code, { url, quality });
      }
    } else {
      // Parse yt-dlp error for non-format errors - pass full error object
      const parsedError = parseYtDlpError(execError);
      throw new ExtractionError(parsedError.message, parsedError.code, { url, quality });
    }
  }

  // Check for errors in stderr
  if (stderr && !stderr.includes("WARNING") && !stderr.includes("Downloading") && !stderr.includes("100%")) {
    const parsedError = parseYtDlpError(stderr);
    throw new ExtractionError(parsedError.message, parsedError.code, { url, quality });
  }

  // Extract actual file path from output
  let filePath: string | null = null;
  
  // First, try to extract from stdout/stderr using patterns
  if (!filePath) {
    const patterns = [
      /\[download\] Destination: (.+)/,
      /\[download\] (.+) has already been downloaded/,
      /\[Merger\] Merging formats into "(.+)"/,
      /\[download\] 100% of (.+)/,
      /\[download\] (.+) has already been downloaded and merged/,
      /\[download\] (.+\.(mp4|webm|mkv|m4a|flv|avi|mov|wmv))/i, // Generic pattern for video files
      /(?:^|\n)(.+\.(mp4|webm|mkv|m4a|flv|avi|mov|wmv))(?:\s|$)/i, // Standalone file path
      /Writing video metadata to (.+)/i,
      /\[ExtractAudio\] Destination: (.+)/i,
    ];
    
    // Combine stdout and stderr for pattern matching
    const combinedOutput = stdout + "\n" + stderr;
    
    for (const pattern of patterns) {
      const matches = combinedOutput.match(pattern);
      if (matches && matches[1]) {
        const candidatePath = matches[1].trim().replace(/^["']|["']$/g, '');
        // Check if it's an absolute path or relative to TEMP_DIR
        if (path.isAbsolute(candidatePath)) {
          filePath = candidatePath;
        } else if (!candidatePath.includes('..')) {
          // Safe relative path
          filePath = path.resolve(TEMP_DIR, candidatePath);
        }
        if (filePath) {
          console.log("[downloadVideo] Extracted file path from output pattern:", pattern.toString(), "filePath:", filePath);
          break;
        }
      }
    }
  }
  
  // Clean up file path - remove quotes and normalize
  if (filePath) {
    filePath = filePath.trim().replace(/^["']|["']$/g, '');
    // Normalize path separators (important for Windows)
    filePath = path.normalize(filePath);
    console.log("[downloadVideo] Extracted file path from output - downloadId:", downloadId, "filePath:", filePath);
  }
  
  // Also try to construct expected filename from output template
  // yt-dlp might have saved it with a specific extension
  if (!filePath) {
    const commonExtensions = ['mp4', 'webm', 'mkv', 'm4a', 'flv', 'avi'];
    for (const ext of commonExtensions) {
      const expectedPath = path.join(TEMP_DIR, `${filePrefix}.${ext}`);
      try {
        await fs.access(expectedPath);
        const stats = await fs.stat(expectedPath);
        if (stats.size > 0) {
          filePath = expectedPath;
          console.log("[downloadVideo] Found file using expected filename:", filePath);
          break;
        }
      } catch {
        // File doesn't exist with this extension
      }
    }
  }
  
  // If still no file path, scan temp directory for the newest video file
  // This is the fallback - check ALL video files, not just ones with specific prefixes
  if (!filePath) {
    try {
      const files = await fs.readdir(TEMP_DIR);
      // If we have a downloadId, look for files starting with it first
      const prefix = downloadId ? downloadId.replace(/[^a-z0-9_]/gi, '_') : null;
      console.log("[downloadVideo] Scanning temp directory for file - downloadId:", downloadId, "prefix:", prefix);
      console.log("[downloadVideo] Total files in temp directory:", files.length);
      console.log("[downloadVideo] Sample files:", files.slice(0, 10).join(", "));
      
      // First, try to find files matching the downloadId prefix
      let videoFiles: Array<{name: string, fullPath: string, hasDownloadId: boolean}> = [];
      
      if (prefix) {
        const prefixFiles = files
          .filter((f) => {
            const lower = f.toLowerCase();
            const hasVideoExt = lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mkv") || lower.endsWith(".m4a") || lower.endsWith(".flv") || lower.endsWith(".avi");
            return f.startsWith(prefix) && hasVideoExt;
          })
          .map(f => ({
            name: f,
            fullPath: path.resolve(TEMP_DIR, f),
            hasDownloadId: true
          }));
        
        if (prefixFiles.length > 0) {
          console.log("[downloadVideo] Found", prefixFiles.length, "files matching downloadId prefix:", prefix);
          videoFiles = prefixFiles;
        }
      }
      
      // If no files with downloadId prefix, check ALL video files (less restrictive)
      if (videoFiles.length === 0) {
        console.log("[downloadVideo] No files with downloadId prefix, checking all video files");
        videoFiles = files
          .filter((f) => {
            const lower = f.toLowerCase();
            return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mkv") || lower.endsWith(".m4a") || lower.endsWith(".flv") || lower.endsWith(".avi");
          })
          .map(f => ({
            name: f,
            fullPath: path.resolve(TEMP_DIR, f),
            hasDownloadId: false
          }));
      }
      
      if (videoFiles.length > 0) {
        console.log("[downloadVideo] Found", videoFiles.length, "potential video files");
        // Get the most recently modified file
        const filesWithStats = await Promise.all(
          videoFiles.map(async (f) => {
            try {
              const stats = await fs.stat(f.fullPath);
              return { ...f, mtime: stats.mtime.getTime(), size: stats.size };
            } catch {
              return null;
            }
          })
        );
        
        const validFiles = filesWithStats.filter(f => f !== null && f.size > 0) as Array<{name: string, fullPath: string, mtime: number, size: number, hasDownloadId?: boolean}>;
        if (validFiles.length > 0) {
          // Filter to only files created after download started (within last 10 minutes to be safe)
          const minMtime = downloadStartTime - (10 * 60 * 1000); // 10 minutes before start
          const recentFiles = validFiles.filter(f => f.mtime >= minMtime);
          
          const filesToCheck = recentFiles.length > 0 ? recentFiles : validFiles;
          
          // Prefer files with download ID, then sort by modification time (newest first)
          const sorted = filesToCheck.sort((a, b) => {
            if (a.hasDownloadId && !b.hasDownloadId) return -1;
            if (!a.hasDownloadId && b.hasDownloadId) return 1;
            return b.mtime - a.mtime;
          });
          const newest = sorted[0];
          filePath = newest.fullPath; // Use absolute path
          console.log("[downloadVideo] Found file by scanning directory - downloadId:", downloadId, "filePath:", filePath, "hasDownloadId:", newest.hasDownloadId, "size:", newest.size, "mtime:", new Date(newest.mtime).toISOString(), "created after download start:", newest.mtime >= downloadStartTime);
        } else {
          console.error("[downloadVideo] No valid video files found (all were empty or inaccessible)");
        }
      } else {
        console.error("[downloadVideo] No video files found in temp directory");
        console.error("[downloadVideo] Available files:", files.join(", "));
      }
    } catch (readError) {
      console.error("[downloadVideo] Error reading temp directory:", readError);
    }
  }

  if (!filePath) {
    throw new ExtractionError(
      "Could not determine downloaded file path",
      "FILE_PATH_ERROR",
      { url, stdout }
    );
  }

  // Ensure absolute path
  if (!path.isAbsolute(filePath)) {
    filePath = path.resolve(filePath);
  }
  
  // Final normalization
  filePath = path.normalize(filePath);

  // Wait a bit for file to be fully written (yt-dlp might still be writing)
  // Optimized: faster checks with reduced retries
  let retries = 5; // Reduced from 10 to 5 for faster failure detection
  let fileExists = false;
  let lastError: Error | null = null;
  
  while (retries > 0) {
    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      if (stats.size > 0) {
        fileExists = true;
        console.log("[downloadVideo] File verified:", filePath, "Size:", stats.size, "bytes");
        break;
      } else {
        // Only log if we're on last retry to reduce noise
        if (retries === 1) {
          console.log("[downloadVideo] File exists but is empty, waiting...");
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // File not ready yet or doesn't exist
    }
    retries--;
    if (retries > 0) {
      // Faster retries: reduced wait times
      const waitTime = 300 + (5 - retries) * 100; // 300ms, 400ms, 500ms, etc. (faster than before)
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  if (!fileExists) {
    console.error("[downloadVideo] File not found after retries:", filePath);
    console.error("[downloadVideo] Last error:", lastError?.message);
    console.error("[downloadVideo] stdout sample:", stdout.substring(0, 1000));
    console.error("[downloadVideo] stderr sample:", stderr.substring(0, 1000));
    
    // Try one more time to list files in the directory for debugging
    try {
      const files = await fs.readdir(TEMP_DIR);
      console.error("[downloadVideo] Files in temp directory:", files.join(", "));
    } catch (dirError) {
      console.error("[downloadVideo] Could not list temp directory:", dirError);
    }
    
    throw new ExtractionError(
      "Downloaded file not found - file may not have been saved by yt-dlp",
      "FILE_NOT_FOUND",
      { filePath, url, stdout: stdout.substring(0, 500), stderr: stderr.substring(0, 500) }
    );
  }

  // Get metadata with proper URL escaping - optimized for speed
  // Skip metadata fetch if we already have it from download output
  // This saves a second API call and speeds up downloads significantly
  let metadata: any;
  try {
    // Try to extract metadata from stdout/stderr first (faster, no extra API call)
    const combinedOutput = stdout + "\n" + stderr;
    const jsonMatch = combinedOutput.match(/\{[\s\S]*"title"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        metadata = JSON.parse(jsonMatch[0]);
        console.log("[downloadVideo] Extracted metadata from download output (fast path)");
      } catch {
        // Fall through to API call
      }
    }
    
    // If metadata extraction from output failed, fetch it via API (slower)
    if (!metadata || !metadata.title) {
      const metadataCommand = await buildYtDlpCommand(url, {
        json: true,
        noDownload: true,
      });
      const { stdout: metadataStdout } = await execAsync(metadataCommand, {
        timeout: 60000, // Reduced from 120s to 60s for faster timeout
        maxBuffer: 10 * 1024 * 1024,
      });
      metadata = JSON.parse(metadataStdout);
      console.log("[downloadVideo] Fetched metadata via API (fallback path)");
    }
  } catch (metadataError: any) {
    // If metadata fetch fails, use basic metadata from file
    metadata = {
      title: "Unknown",
      uploader: "Unknown",
      ext: path.extname(filePath).slice(1) || "mp4",
    };
    console.log("[downloadVideo] Using fallback metadata");
  }

  return { filePath, metadata };
}

