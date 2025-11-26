// API route for streaming/downloading video files

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { getDownload } from "@/lib/services/downloadCache";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const TEMP_DIR = path.join(os.tmpdir(), "grablink-downloads");

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle OPTIONS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

// Ensure temp directory exists
async function ensureTempDir(): Promise<void> {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    console.error("[stream] Failed to create temp directory:", error);
    // Continue anyway - directory might already exist
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const downloadId = searchParams.get("downloadId");

    if (!downloadId) {
      return new NextResponse("downloadId parameter is required", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Ensure temp directory exists
    await ensureTempDir();

    // Try to get from cache first
    let download = await getDownload(downloadId);
    let normalizedPath: string | null = null;

    if (download) {
      // Found in cache - use cached path
      normalizedPath = path.isAbsolute(download.filePath)
        ? path.normalize(download.filePath)
        : path.normalize(path.resolve(download.filePath));
      console.log("[stream] ✅ Found in cache - downloadId:", downloadId, "filePath:", normalizedPath);
    } else {
      // Not in cache (serverless function restart) - find file by download ID
      console.log("[stream] ⚠️ Not in cache, searching for file by downloadId:", downloadId);
      
      try {
        // Sanitize downloadId for filename search (same logic as in downloadVideo)
        const sanitizedId = downloadId.replace(/[^a-z0-9_]/gi, '_');
        console.log("[stream] 🔍 Sanitized downloadId for search - original:", downloadId, "sanitized:", sanitizedId);
        
        // Ensure directory exists before reading
        await ensureTempDir();
        const files = await fs.readdir(TEMP_DIR);
        console.log("[stream] Files in temp directory:", files.length, "files");
        
        // Find file starting with the download ID (more flexible matching)
        const matchingFile = files.find(f => {
          const nameWithoutExt = f.substring(0, f.lastIndexOf('.') >= 0 ? f.lastIndexOf('.') : f.length);
          // Match if filename starts with sanitized ID or contains it
          const matches = nameWithoutExt.startsWith(sanitizedId) || 
                         nameWithoutExt === sanitizedId ||
                         nameWithoutExt.includes(sanitizedId);
          if (matches) {
            console.log("[stream] Potential match found:", f, "nameWithoutExt:", nameWithoutExt);
          }
          return matches;
        });

        if (matchingFile) {
          normalizedPath = path.resolve(TEMP_DIR, matchingFile);
          console.log("[stream] ✅ Found file by downloadId match - downloadId:", downloadId, "sanitizedId:", sanitizedId, "file:", matchingFile, "path:", normalizedPath);
          
          // Try to get metadata from file extension
          const ext = path.extname(matchingFile).toLowerCase();
          const format = ext === '.mp3' || ext === '.m4a' ? 'audio' : 'video';
          
          // Create a download entry from the file
          download = {
            filePath: normalizedPath,
            filename: matchingFile,
            metadata: {},
            expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
            format: format as "video" | "audio"
          };
        } else {
          console.error("[stream] No matching file found. Looking for:", sanitizedId);
          console.error("[stream] Available files:", files.slice(0, 10)); // Log first 10 files
          
          // Fallback: try to find the most recently modified video/audio file
          // This helps if the downloadId format doesn't match exactly
          try {
            const videoExtensions = ['.mp4', '.webm', '.mkv', '.m4a', '.mp3'];
            const videoFiles = files.filter(f => {
              const ext = path.extname(f).toLowerCase();
              return videoExtensions.includes(ext);
            });
            
            if (videoFiles.length > 0) {
              // Get file stats and sort by modification time (newest first)
              const filesWithStats = await Promise.all(
                videoFiles.map(async (f) => {
                  try {
                    const fullPath = path.resolve(TEMP_DIR, f);
                    const stats = await fs.stat(fullPath);
                    return { name: f, fullPath, mtime: stats.mtime.getTime(), size: stats.size };
                  } catch {
                    return null;
                  }
                })
              );
              
              const validFiles = filesWithStats.filter(f => f !== null && f.size > 0) as Array<{
                name: string;
                fullPath: string;
                mtime: number;
                size: number;
              }>;
              
              if (validFiles.length > 0) {
                // Sort by modification time (newest first) and take the most recent
                validFiles.sort((a, b) => b.mtime - a.mtime);
                const newest = validFiles[0];
                normalizedPath = newest.fullPath;
                
                const ext = path.extname(newest.name).toLowerCase();
                const format = ext === '.mp3' || ext === '.m4a' ? 'audio' : 'video';
                
                download = {
                  filePath: normalizedPath,
                  filename: newest.name,
                  metadata: {},
                  expiresAt: Date.now() + 60 * 60 * 1000,
                  format: format as "video" | "audio"
                };
                
                console.log("[stream] ⚠️ Using fallback - most recent file - downloadId:", downloadId, "file:", newest.name, "path:", normalizedPath);
              }
            }
          } catch (fallbackError) {
            console.error("[stream] Fallback file search failed:", fallbackError);
          }
        }
      } catch (dirError: unknown) {
        console.error("[stream] Error reading temp directory:", dirError);
        // If directory doesn't exist, try to create it
        if (dirError && typeof dirError === 'object' && 'code' in dirError && dirError.code === 'ENOENT') {
          await ensureTempDir();
        }
      }
    }

    if (!download || !normalizedPath) {
      console.error("[stream] ❌ Download not found in cache or file system - downloadId:", downloadId);
      return new NextResponse(`Download not found or expired (downloadId: ${downloadId})`, { 
        status: 404,
        headers: corsHeaders 
      });
    }
    
    console.log("[stream] ✅ Download found - downloadId:", downloadId, "filename:", download.filename, "filePath:", normalizedPath);

    // Check if file exists
    try {
      await fs.access(normalizedPath);
      const stats = await fs.stat(normalizedPath);
      if (stats.size === 0) {
        console.error("[stream] File is empty:", normalizedPath);
        return new NextResponse("File is empty", { 
          status: 404,
          headers: corsHeaders 
        });
      }
      console.log("[stream] File exists, size:", stats.size);
    } catch (error) {
      console.error("[stream] File not found at:", normalizedPath);
      console.error("[stream] Error:", error);
      // Try to list files in the directory to debug
      try {
        const dir = path.dirname(normalizedPath);
        const files = await fs.readdir(dir);
        console.error("[stream] Files in directory:", files);
      } catch (dirError) {
        console.error("[stream] Could not read directory:", dirError);
      }
      return new NextResponse(`File not found at: ${normalizedPath}`, { 
        status: 404,
        headers: corsHeaders 
      });
    }

    // Read file using normalized path
    const fileBuffer = await fs.readFile(normalizedPath);
    const fileStats = await fs.stat(normalizedPath);

    // Determine content type
    const ext = path.extname(download.filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mkv": "video/x-matroska",
      ".mp3": "audio/mpeg",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
    };
    const contentType = contentTypeMap[ext] || "application/octet-stream";

    // Escape filename for Content-Disposition header (RFC 5987)
    const escapedFilename = download.filename.replace(/["\\]/g, '\\$&');
    const encodedFilename = encodeURIComponent(download.filename);

    // Return file with proper headers including CORS
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${escapedFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": fileStats.size.toString(),
        "Cache-Control": "no-cache",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(`Error: ${errorMessage}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
}

