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
 */
export async function getVideoInfo(url: string): Promise<VideoInfoResponse> {
  // Check for TikTok URLs early and return friendly error
  const urlLower = url.toLowerCase();
  if (urlLower.includes("tiktok.com") || urlLower.includes("vm.tiktok.com") || urlLower.includes("vt.tiktok.com")) {
    return {
      success: false,
      platform: "unknown",
      url,
      qualities: [],
      downloadOptions: {
        recommendedMethod: "proxy",
        supportsDirect: false,
        supportsStreaming: true,
      },
      error: {
        code: "PLATFORM_NOT_SUPPORTED",
        message: "TikTok is currently not supported. We're working on adding support for other platforms. Please try Instagram, YouTube, Twitter, or other supported platforms.",
      },
    };
  }

  const platform = detectPlatform(url);

  if (!isPlatformSupported(platform)) {
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
        code: "PLATFORM_NOT_SUPPORTED",
        message: `Platform "${platform}" is not supported. Supported platforms: Instagram, YouTube, Twitter, Facebook, Pinterest, Vimeo, Twitch, and Reddit.`,
      },
    };
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
    console.log("[getVideoInfo] Detected yt-dlp command:", ytDlpCmd);
    
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
    
    try {
      const result = await execAsync(command, {
        timeout: 120000, // 2 minutes timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
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
        const errorOutput = execError.stderr || execError.stdout || execError.message || "";
        const parsedError = parseYtDlpError(errorOutput);
        
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

    return {
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
  // Check for TikTok URLs early and return friendly error
  const urlLower = url.toLowerCase();
  if (urlLower.includes("tiktok.com") || urlLower.includes("vm.tiktok.com") || urlLower.includes("vt.tiktok.com")) {
    throw new ExtractionError(
      "TikTok is currently not supported. We're working on adding support for other platforms. Please try Instagram, YouTube, Twitter, or other supported platforms.",
      "PLATFORM_NOT_SUPPORTED",
      { platform: "unknown", url }
    );
  }

  // Validate platform before downloading
  const platform = detectPlatform(url);
  if (!isPlatformSupported(platform)) {
    throw new ExtractionError(
      `Platform "${platform}" is not supported. Supported platforms: Instagram, YouTube, Twitter, Facebook, Pinterest, Vimeo, Twitch, and Reddit.`,
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
  
  // Normalize URL
  let finalDownloadUrl = url.trim();
  if (!finalDownloadUrl.startsWith("http://") && !finalDownloadUrl.startsWith("https://")) {
    finalDownloadUrl = "https://" + finalDownloadUrl;
  }
  finalDownloadUrl = finalDownloadUrl.replace(/\/+$/, "");
  finalDownloadUrl = finalDownloadUrl.replace(/([^:]\/)\/+/g, "$1");

  // Download video with size optimization
  // Limit to 720p max to reduce file size while maintaining good quality
  // This significantly reduces file sizes (720p is ~50% smaller than 1080p)
  // Format includes /best fallback if 720p isn't available
  const command = await buildYtDlpCommand(finalDownloadUrl, {
    maxHeight: 720, // Limit to 720p for smaller file sizes, with fallback to best
    output: outputFile,
  });
  
  console.log("[downloadVideo] Executing command:", command.substring(0, 200) + "...");

  let stdout: string;
  let stderr: string;

  try {
    const result = await execAsync(command, {
      timeout: 900000, // 15 minutes timeout (increased for larger files)
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer (increased for verbose output)
    });
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
      // Retry with best quality (no height restriction)
      const fallbackCommand = await buildYtDlpCommand(url, {
        format: "best", // Use best available quality without height restriction
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
        const parsedError = parseYtDlpError(errorOutput);
        throw new ExtractionError(parsedError.message, parsedError.code, { url, quality });
      }
    } else {
      // Parse yt-dlp error for non-format errors
      const parsedError = parseYtDlpError(errorOutput);
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
  // Increase wait time and retries for slower systems
  let retries = 10;
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
        console.log("[downloadVideo] File exists but is empty, waiting... (retries left:", retries, ")");
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // File not ready yet or doesn't exist
    }
    retries--;
    if (retries > 0) {
      // Wait longer on each retry (exponential backoff)
      const waitTime = 500 + (10 - retries) * 200; // 500ms, 700ms, 900ms, etc.
      console.log("[downloadVideo] Waiting", waitTime, "ms before retry", (10 - retries + 1), "of 10");
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

  // Get metadata with proper URL escaping
  let metadata: any;
  try {
    const metadataCommand = await buildYtDlpCommand(url, {
      json: true,
      noDownload: true,
    });
    const { stdout: metadataStdout } = await execAsync(metadataCommand, {
      timeout: 120000, // 2 minutes timeout
      maxBuffer: 10 * 1024 * 1024,
    });
    metadata = JSON.parse(metadataStdout);
  } catch (metadataError: any) {
    // If metadata fetch fails, use basic metadata
    metadata = {
      title: "Unknown",
      uploader: "Unknown",
      ext: path.extname(filePath).slice(1) || "mp4",
    };
  }

  return { filePath, metadata };
}

