// Audio extraction service using FFmpeg

import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { parseFFmpegError, ExtractionError } from "@/lib/utils/errors";
import { escapePath } from "@/lib/utils/command";

// Lazy initialization of FFmpeg path to avoid Next.js build issues
let ffmpegPathInitialized = false;

function initializeFfmpegPath() {
  if (ffmpegPathInitialized) return;
  
  try {
    let ffmpegPath: string | null = null;
    const platform = os.platform();
    const arch = os.arch();
    const platformArch = `${platform}-${arch}`;
    const binary = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    
    // Manually resolve FFmpeg path to avoid Next.js bundling issues
    // This matches the logic from @ffmpeg-installer/ffmpeg but avoids importing it
    const fsSync = require("fs");
    const possiblePaths = [
      // npm3+ flat structure (most common)
      path.join(process.cwd(), "node_modules", "@ffmpeg-installer", platformArch, binary),
      // npm2 nested structure
      path.join(process.cwd(), "node_modules", "@ffmpeg-installer", "ffmpeg", "node_modules", "@ffmpeg-installer", platformArch, binary),
      // Alternative nested structure
      path.join(process.cwd(), "node_modules", "@ffmpeg-installer", "ffmpeg", "..", platformArch, binary),
    ];
    
    for (const possiblePath of possiblePaths) {
      try {
        if (fsSync.existsSync(possiblePath)) {
          ffmpegPath = possiblePath;
          break;
        }
      } catch {
        // Continue to next path
      }
    }

    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    } else {
      console.warn("FFmpeg not found in node_modules, will try system FFmpeg from PATH");
    }
    // If no path found, fluent-ffmpeg will try to use system FFmpeg from PATH
  } catch (error) {
    console.error("Failed to set FFmpeg path:", error);
    // Will try to use system FFmpeg as fallback
  }
  
  ffmpegPathInitialized = true;
}

const TEMP_DIR = path.join(os.tmpdir(), "grablink-downloads");

/**
 * Extract audio from video file
 */
export async function extractAudio(
  videoPath: string,
  outputFormat: "mp3" | "m4a" = "mp3",
  bitrate: string = "256k", // Increased to 256k for better audio quality
  downloadId?: string // Pass downloadId for filename
): Promise<string> {
  // Initialize FFmpeg path on first use
  initializeFfmpegPath();

  // Validate input file exists
  try {
    await fs.access(videoPath);
  } catch (error) {
    throw new ExtractionError(
      `Video file not found: ${videoPath}`,
      "FILE_NOT_FOUND",
      { videoPath }
    );
  }

  // Validate output format
  if (outputFormat !== "mp3" && outputFormat !== "m4a") {
    throw new ExtractionError(
      `Unsupported audio format: ${outputFormat}. Supported formats: mp3, m4a`,
      "UNSUPPORTED_FORMAT",
      { outputFormat }
    );
  }

  // Ensure temp directory exists
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

  // Use downloadId in the output filename for reliable tracking
  const outputPath = path.resolve(TEMP_DIR, `${downloadId || `audio_${Date.now()}`}.${outputFormat}`);
  console.log("[extractAudio] Starting audio extraction - downloadId:", downloadId, "outputPath:", outputPath);

  return new Promise((resolve, reject) => {
    let hasResolved = false;
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        reject(
          new ExtractionError(
            "Audio extraction timed out - process took too long",
            "TIMEOUT",
            { videoPath, outputFormat }
          )
        );
      }
    }, 300000); // 5 minutes timeout

    const ffmpegProcess = ffmpeg(videoPath)
      .toFormat(outputFormat)
      .audioBitrate(bitrate)
      .audioCodec(outputFormat === "mp3" ? "libmp3lame" : "aac")
      // Add audio filter to make audio louder (6dB = ~2x louder, safe boost)
      .audioFilters("volume=6dB")
      // Use high quality encoding settings
      .audioQuality(outputFormat === "mp3" ? 0 : 5) // 0 = highest quality for MP3, 5 = high quality for AAC
      .on("start", (commandLine) => {
        // FFmpeg process started
        console.log("[extractAudio] FFmpeg command:", commandLine);
      })
      .on("progress", (progress) => {
        // Progress updates (optional)
      })
      .on("end", async () => {
        if (hasResolved) return;
        hasResolved = true;
        clearTimeout(timeout);

        // Verify output file exists with retry logic (FFmpeg might still be writing)
        let retries = 5;
        let fileExists = false;
        while (retries > 0) {
          try {
            await fs.access(outputPath);
            const stats = await fs.stat(outputPath);
            if (stats.size > 0) {
              fileExists = true;
              break;
            }
          } catch {
            // File not ready yet
          }
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
          }
        }

        if (!fileExists) {
          reject(
            new ExtractionError(
              "Audio extraction completed but output file not found or is empty",
              "FILE_NOT_FOUND",
              { outputPath, downloadId }
            )
          );
          return;
        }

        // Ensure absolute path
        const absolutePath = path.isAbsolute(outputPath) 
          ? path.normalize(outputPath)
          : path.normalize(path.resolve(outputPath));
        
        console.log("[extractAudio] Audio extraction completed successfully - filePath:", absolutePath);
        resolve(absolutePath);
      })
      .on("error", (err) => {
        if (hasResolved) return;
        hasResolved = true;
        clearTimeout(timeout);

        const errorMessage = err.message || "Unknown FFmpeg error";
        const parsedError = parseFFmpegError(errorMessage);
        
        reject(
          new ExtractionError(
            parsedError.message,
            parsedError.code,
            { videoPath, outputFormat, originalError: errorMessage }
          )
        );
      })
      .save(outputPath);

    // Handle process errors
    ffmpegProcess.on("error", (err) => {
      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(timeout);

      const errorMessage = err.message || "Unknown FFmpeg process error";
      const parsedError = parseFFmpegError(errorMessage);
      
      reject(
        new ExtractionError(
          parsedError.message,
          parsedError.code,
          { videoPath, outputFormat, originalError: errorMessage }
        )
      );
    });
  });
}

/**
 * Get audio file size
 */
export async function getAudioFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    // Return 0 if file doesn't exist or can't be accessed
    return 0;
  }
}

/**
 * Clean up temporary files
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // File might already be deleted, ignore error
  }
}

