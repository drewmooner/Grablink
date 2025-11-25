// Command building utilities for yt-dlp and other commands

import * as path from "path";
import * as os from "os";

/**
 * Escape URL for use in shell command
 * Handles special characters in URLs
 */
export function escapeUrl(url: string): string {
  // On Windows, use double quotes and escape internal quotes
  // On Unix, use single quotes to prevent expansion
  if (os.platform() === "win32") {
    // Windows: escape quotes and wrap in double quotes
    return `"${url.replace(/"/g, '\\"')}"`;
  } else {
    // Unix: wrap in single quotes (no expansion needed)
    return `'${url.replace(/'/g, "'\\''")}'`;
  }
}

/**
 * Escape file path for use in shell command
 * Handles spaces and special characters in paths
 */
export function escapePath(filePath: string): string {
  // Normalize path separators
  const normalizedPath = path.normalize(filePath);
  
  // On Windows, use double quotes and escape internal quotes
  // On Unix, use single quotes
  if (os.platform() === "win32") {
    // Windows: escape quotes and wrap in double quotes
    // Backslashes don't need escaping in double-quoted strings on Windows
    return `"${normalizedPath.replace(/"/g, '\\"')}"`;
  } else {
    // Unix: wrap in single quotes and escape any single quotes inside
    return `'${normalizedPath.replace(/'/g, "'\\''")}'`;
  }
}

/**
 * Build yt-dlp command with proper escaping
 */
export function buildYtDlpCommand(
  url: string,
  options: {
    format?: string;
    output?: string;
    json?: boolean;
    noDownload?: boolean;
    maxHeight?: number; // Maximum video height (e.g., 720 for 720p)
    compress?: boolean; // Whether to compress video
  } = {}
): string {
  const parts: string[] = ["yt-dlp"];

  // Gracefully skip TikTok URLs - they should be caught earlier, but just in case
  const urlLower = url.toLowerCase();
  if (urlLower.includes("tiktok.com") || urlLower.includes("vm.tiktok.com") || urlLower.includes("vt.tiktok.com")) {
    console.warn("[buildYtDlpCommand] TikTok URL detected - should have been caught earlier. Skipping TikTok-specific handling.");
  }

  // Standard options for all platforms
  parts.push("--socket-timeout", "30");
  parts.push("--retries", "3");
  parts.push("--fragment-retries", "3");
  parts.push("--extractor-retries", "3");
  parts.push("--no-check-certificate");

  // Add format option (format string may contain special characters like brackets)
  if (options.format) {
    // Format strings like "best[height<=1080]" need to be quoted
    if (os.platform() === "win32") {
      parts.push(`-f "${options.format}"`);
    } else {
      parts.push(`-f '${options.format}'`);
    }
  } else if (options.maxHeight) {
    // Use format selector with maxHeight
    const maxHeight = options.maxHeight;
    if (os.platform() === "win32") {
      parts.push(`-f "bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best"`);
    } else {
      parts.push(`-f 'bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best'`);
    }
  }

  // Add output option with proper escaping
  if (options.output) {
    parts.push(`-o ${escapePath(options.output)}`);
  }

  // Add JSON dump option
  if (options.json) {
    parts.push("--dump-json");
  }

  // Add no-download option
  if (options.noDownload) {
    parts.push("--no-download");
  }

  // Add URL with proper escaping (always last)
  parts.push(escapeUrl(url));

  return parts.join(" ");
}

