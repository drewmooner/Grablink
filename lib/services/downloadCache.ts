// Simple in-memory cache for download tracking

import * as fs from "fs/promises";

interface DownloadCacheEntry {
  filePath: string;
  filename: string;
  metadata: any;
  expiresAt: number;
  format: "video" | "audio";
}

const downloadCache = new Map<string, DownloadCacheEntry>();

/**
 * Clean up expired cache entries and their files
 */
async function cleanupExpiredEntries() {
  const now = Date.now();
  const expiredIds: string[] = [];

  for (const [id, entry] of downloadCache.entries()) {
    if (entry.expiresAt < now) {
      expiredIds.push(id);
    }
  }

  // Delete files and remove from cache
  for (const id of expiredIds) {
    const entry = downloadCache.get(id);
    if (entry) {
      try {
        // Delete the actual file
        await fs.unlink(entry.filePath);
      } catch (error) {
        // File might already be deleted, ignore error
      }
      // Remove from cache
      downloadCache.delete(id);
    }
  }
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  cleanupExpiredEntries().catch((error) => {
    console.error("Error cleaning up expired cache entries:", error);
  });
}, 5 * 60 * 1000);

/**
 * Store download in cache
 */
export function storeDownload(
  downloadId: string,
  filePath: string,
  filename: string,
  metadata: any,
  format: "video" | "audio" = "video",
  ttl: number = 60 * 60 * 1000 // 1 hour default
): void {
  downloadCache.set(downloadId, {
    filePath,
    filename,
    metadata,
    expiresAt: Date.now() + ttl,
    format,
  });
}

/**
 * Get download from cache
 */
export async function getDownload(downloadId: string): Promise<DownloadCacheEntry | null> {
  const entry = downloadCache.get(downloadId);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    // Clean up expired entry and file
    try {
      await fs.unlink(entry.filePath);
    } catch (error) {
      // File might already be deleted, ignore error
    }
    downloadCache.delete(downloadId);
    return null;
  }

  return entry;
}

/**
 * Generate download ID
 */
export function generateDownloadId(): string {
  return `dl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

