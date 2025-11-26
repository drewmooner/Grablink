// API route for video download

import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/middleware/rateLimit";

// Increase timeout for video processing (especially for larger files)
export const maxDuration = 900; // 15 minutes timeout (increased for YouTube, Twitter, Pinterest large files)
export const runtime = "nodejs";

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
import { downloadVideo } from "@/lib/services/videoExtractor";
import { extractAudio, cleanupTempFile } from "@/lib/services/audioExtractor";
import { generateDownloadId, storeDownload } from "@/lib/services/downloadCache";
import { addToHistory } from "@/lib/services/history";
import { detectPlatform } from "@/lib/utils/platform";
import { isValidUrl } from "@/lib/utils/url";
import { ExtractionError } from "@/lib/utils/errors";
import type { VideoDownloadRequest, VideoDownloadResponse } from "@/lib/types";
import * as path from "path";

/**
 * Generate filename from metadata
 */
function generateFilename(metadata: { title?: string; ext?: string; uploader_id?: string; uploader?: string; upload_date?: string }, platform: string, format: "video" | "audio"): string {
  const ext = format === "audio" ? "mp3" : metadata.ext || "mp4";
  const title = (metadata.title || "video")
    .replace(/[^a-z0-9]/gi, "_")
    .substring(0, 50);
  const author = (metadata.uploader_id || metadata.uploader || "unknown")
    .replace(/[^a-z0-9]/gi, "_")
    .substring(0, 30);
  const date = metadata.upload_date
    ? `${metadata.upload_date.slice(0, 4)}-${metadata.upload_date.slice(4, 6)}-${metadata.upload_date.slice(6, 8)}`
    : new Date().toISOString().split("T")[0];

  return `${platform}_${author}_${title}_${date}.${ext}`;
}

async function handleDownload(request: NextRequest) {
  try {
    const body: VideoDownloadRequest = await request.json();
    const { url, format = "video", audioFormat = "mp3" } = body;
    // Note: quality parameter is ignored - always downloads in original quality

    // Validate request
    if (!url || typeof url !== "string") {
      return NextResponse.json<VideoDownloadResponse>(
        {
          success: false,
          platform: "unknown",
          error: {
            code: "INVALID_URL",
            message: "URL is required and must be a string",
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate URL format
    if (!isValidUrl(url)) {
      return NextResponse.json<VideoDownloadResponse>(
        {
          success: false,
          platform: detectPlatform(url),
          error: {
            code: "INVALID_URL",
            message: "Invalid URL format. Please provide a valid HTTP or HTTPS URL",
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check for TikTok URLs early and return friendly error
    const urlLower = url.toLowerCase();
    if (urlLower.includes("tiktok.com") || urlLower.includes("vm.tiktok.com") || urlLower.includes("vt.tiktok.com")) {
      return NextResponse.json<VideoDownloadResponse>(
        {
          success: false,
          platform: "unknown",
          error: {
            code: "PLATFORM_NOT_SUPPORTED",
            message: "TikTok is currently not supported. We're working on adding support for other platforms. Please try Instagram, YouTube, Twitter, or other supported platforms.",
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const platform = detectPlatform(url);

    try {
      // Generate download ID FIRST so we can use it in the filename
      const downloadId = generateDownloadId();
      
      // Download video (always in original quality, quality parameter ignored)
      // Pass downloadId so it can be used in the filename for reliable tracking
      const { filePath, metadata } = await downloadVideo(url, undefined, undefined, downloadId);

      let finalFilePath = filePath;
      let finalFormat = format;

      // If audio format requested, extract audio
      if (format === "audio") {
        try {
          // Pass downloadId so audio file uses the same ID for tracking
          // Using 256k bitrate for better audio quality
          const audioPath = await extractAudio(filePath, audioFormat, "256k", downloadId);
          // Normalize audio path to absolute
          finalFilePath = path.isAbsolute(audioPath) 
            ? path.normalize(audioPath)
            : path.normalize(path.resolve(audioPath));
          finalFormat = "audio";
          // Clean up video file after successful audio extraction
          await cleanupTempFile(filePath);
        } catch (audioError) {
          // If audio extraction fails, clean up video file and throw error
          await cleanupTempFile(filePath);
          
          // Re-throw ExtractionError as-is
          if (audioError instanceof ExtractionError) {
            throw audioError;
          }
          
          // Wrap other errors
          throw new ExtractionError(
            `Audio extraction failed: ${audioError instanceof Error ? audioError.message : "Unknown error"}`,
            "AUDIO_EXTRACTION_FAILED",
            { videoPath: filePath, audioFormat }
          );
        }
      }

      // Generate filename
      const filename = generateFilename(metadata, platform, finalFormat);

      // Ensure absolute path before storing
      const absoluteFilePath = path.isAbsolute(finalFilePath) 
        ? finalFilePath 
        : path.resolve(finalFilePath);
      
      // Normalize path separators
      const normalizedFilePath = path.normalize(absoluteFilePath);
      
      // Verify file exists one more time before storing
      const fs = await import("fs/promises");
      try {
        await fs.access(normalizedFilePath);
        const stats = await fs.stat(normalizedFilePath);
        if (stats.size === 0) {
          throw new ExtractionError(
            "File is empty before storing in cache",
            "FILE_EMPTY",
            { filePath: normalizedFilePath }
          );
        }
        console.log("[handleDownload] Storing in cache - file verified:", normalizedFilePath, "Size:", stats.size);
      } catch (verifyError) {
        console.error("[handleDownload] File verification failed:", normalizedFilePath, verifyError);
        throw new ExtractionError(
          "File does not exist before storing in cache",
          "FILE_NOT_FOUND",
          { filePath: normalizedFilePath }
        );
      }

      // Store in cache with normalized absolute path
      storeDownload(downloadId, normalizedFilePath, filename, metadata, finalFormat);

      // Get file size using normalized path
      const fileStats = await fs.stat(normalizedFilePath);
      const fileSize = fileStats.size;

      // Get client IP for history tracking
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                       request.headers.get("x-real-ip") || 
                       "unknown";

      // Add to history (links only, no files) - track all downloads
      // Wrap in try-catch to prevent history errors from breaking the download
      let historyId: string | undefined;
      try {
        historyId = await addToHistory(
          {
            url,
            platform,
            title: metadata.title || "Untitled",
            author: metadata.uploader_id || metadata.uploader || "Unknown",
            thumbnail: metadata.thumbnail || undefined,
            format: finalFormat,
            quality: "original", // Always original quality
            downloadId, // Reference to download if still available
            fileSize: fileSize, // Track file size
            duration: metadata.duration || undefined, // Track video duration
          },
          clientIp
        );
      } catch (historyError) {
        // Log history error but don't fail the download
        console.error("[handleDownload] Failed to add to history:", historyError);
      }

      return NextResponse.json<VideoDownloadResponse>(
        {
          success: true,
          downloadId,
          historyId,
          platform,
          video: {
            quality: "original", // Always original quality
            format: finalFormat === "audio" ? audioFormat : metadata.ext || "mp4",
            size: fileSize,
            duration: metadata.duration || undefined,
            filename,
          },
          download: {
            method: "proxy",
            url: `/api/video/stream?downloadId=${encodeURIComponent(downloadId)}`,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
            directUrl: null,
          },
          metadata: {
            title: metadata.title || "Untitled",
            author: metadata.uploader_id || metadata.uploader || "Unknown",
          },
        },
        { status: 200, headers: corsHeaders }
      );
    } catch (error) {
      // Log the full error for debugging
      console.error("[handleDownload] Download error:", error);
      if (error instanceof Error) {
        console.error("[handleDownload] Error stack:", error.stack);
      }

      // Handle ExtractionError with specific error codes
      if (error instanceof ExtractionError) {
        return NextResponse.json<VideoDownloadResponse>(
          {
            success: false,
            platform,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          },
          { status: 500, headers: corsHeaders }
        );
      }

      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      return NextResponse.json<VideoDownloadResponse>(
        {
          success: false,
          platform,
          error: {
            code: "DOWNLOAD_FAILED",
            message: `Failed to download video: ${errorMessage}`,
          },
        },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error) {
    // Log the full error for debugging
    console.error("[handleDownload] Server error:", error);
    if (error instanceof Error) {
      console.error("[handleDownload] Error stack:", error.stack);
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json<VideoDownloadResponse>(
      {
        success: false,
        platform: "unknown",
        error: {
          code: "SERVER_ERROR",
          message: errorMessage,
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

// Apply rate limiting (20 downloads per hour per IP)
export async function POST(request: NextRequest) {
  return withRateLimit(
    async (req: Request) => {
      const nextReq = req as unknown as NextRequest;
      return handleDownload(nextReq);
    },
    { limit: 20, windowMs: 60 * 60 * 1000 } // 20 per hour
  )(request as unknown as Request);
}

