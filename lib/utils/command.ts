// Command building utilities for yt-dlp and other commands

import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Cache for yt-dlp command path
let ytDlpCommand: string | null = null;

/**
 * Get the yt-dlp command to use (tries yt-dlp first, then python/python3 -m yt_dlp)
 */
export async function getYtDlpCommand(): Promise<string> {
  if (ytDlpCommand) {
    return ytDlpCommand;
  }

  const isWindows = os.platform() === "win32";

  // On Windows, try python first (not python3)
  // On Unix, try python3 first
  if (isWindows) {
    // Try python -m yt_dlp first on Windows
    try {
      await execAsync("python -m yt_dlp --version", { timeout: 5000 });
      ytDlpCommand = "python -m yt_dlp";
      console.log("[getYtDlpCommand] Using python -m yt_dlp (Windows)");
      return ytDlpCommand;
    } catch (error: any) {
      console.log("[getYtDlpCommand] python -m yt_dlp not available on Windows, trying alternatives");
    }
  } else {
    // Try python3 -m yt_dlp first on Unix (most reliable since we install via pip)
    try {
      await execAsync("python3 -m yt_dlp --version", { timeout: 5000 });
      ytDlpCommand = "python3 -m yt_dlp";
      console.log("[getYtDlpCommand] Using python3 -m yt_dlp");
      return ytDlpCommand;
    } catch (error: any) {
      console.log("[getYtDlpCommand] python3 -m yt_dlp not available, trying alternatives");
    }
  }

  // Try yt-dlp command (works on both platforms if installed globally)
  try {
    await execAsync("yt-dlp --version", { timeout: 5000 });
    ytDlpCommand = "yt-dlp";
    console.log("[getYtDlpCommand] Using yt-dlp command");
    return ytDlpCommand;
  } catch (error: any) {
    console.log("[getYtDlpCommand] yt-dlp command not available, trying python alternatives");
  }

  // Try the other python command (python3 on Windows, python on Unix)
  if (isWindows) {
    try {
      await execAsync("python3 -m yt_dlp --version", { timeout: 5000 });
      ytDlpCommand = "python3 -m yt_dlp";
      console.log("[getYtDlpCommand] Using python3 -m yt_dlp (Windows fallback)");
      return ytDlpCommand;
    } catch (error: any) {
      console.log("[getYtDlpCommand] python3 -m yt_dlp not available on Windows");
    }
  } else {
    try {
      await execAsync("python -m yt_dlp --version", { timeout: 5000 });
      ytDlpCommand = "python -m yt_dlp";
      console.log("[getYtDlpCommand] Using python -m yt_dlp (Unix fallback)");
      return ytDlpCommand;
    } catch (error: any) {
      console.log("[getYtDlpCommand] python -m yt_dlp not available on Unix");
    }
  }

  // Default based on platform
  if (isWindows) {
    console.log("[getYtDlpCommand] All methods failed, defaulting to python -m yt_dlp (Windows)");
    ytDlpCommand = "python -m yt_dlp";
  } else {
    console.log("[getYtDlpCommand] All methods failed, defaulting to python3 -m yt_dlp (Unix)");
    ytDlpCommand = "python3 -m yt_dlp";
  }
  return ytDlpCommand;
}

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
export async function buildYtDlpCommand(
  url: string,
  options: {
    format?: string;
    output?: string;
    json?: boolean;
    noDownload?: boolean;
    maxHeight?: number; // Maximum video height (e.g., 720 for 720p)
    compress?: boolean; // Whether to compress video
  } = {}
): Promise<string> {
  const ytDlp = await getYtDlpCommand();
  const parts: string[] = ytDlp.split(" ");

  const urlLower = url.toLowerCase();
  const isTikTok = urlLower.includes("tiktok.com") || urlLower.includes("vm.tiktok.com") || urlLower.includes("vt.tiktok.com");

  // Standard options for all platforms
  parts.push("--socket-timeout", "60");
  parts.push("--retries", "5");
  parts.push("--fragment-retries", "5");
  parts.push("--extractor-retries", "5");
  parts.push("--no-check-certificate");
  
  // TikTok-specific options (2025 best practices)
  if (isTikTok) {
    // Browser impersonation - use Chrome user agent
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    if (os.platform() === "win32") {
      parts.push(`--user-agent "${userAgent}"`);
    } else {
      parts.push(`--user-agent '${userAgent.replace(/'/g, "'\\''")}'`);
    }

    // Referer and headers
    parts.push("--referer", "https://www.tiktok.com/");
    const acceptHeader = "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
    const langHeader = "Accept-Language: en-US,en;q=0.9";
    const secHeader = "Sec-Fetch-Dest: document";
    const secModeHeader = "Sec-Fetch-Mode: navigate";
    const secSiteHeader = "Sec-Fetch-Site: none";
    const secUserHeader = "Sec-Fetch-User: ?1";
    
    if (os.platform() === "win32") {
      parts.push(`--add-header "${acceptHeader}"`);
      parts.push(`--add-header "${langHeader}"`);
      parts.push(`--add-header "${secHeader}"`);
      parts.push(`--add-header "${secModeHeader}"`);
      parts.push(`--add-header "${secSiteHeader}"`);
      parts.push(`--add-header "${secUserHeader}"`);
    } else {
      parts.push(`--add-header '${acceptHeader.replace(/'/g, "'\\''")}'`);
      parts.push(`--add-header '${langHeader.replace(/'/g, "'\\''")}'`);
      parts.push(`--add-header '${secHeader.replace(/'/g, "'\\''")}'`);
      parts.push(`--add-header '${secModeHeader.replace(/'/g, "'\\''")}'`);
      parts.push(`--add-header '${secSiteHeader.replace(/'/g, "'\\''")}'`);
      parts.push(`--add-header '${secUserHeader.replace(/'/g, "'\\''")}'`);
    }

    // TikTok extractor args with device simulation
    const deviceId = Math.floor(Math.random() * 1000000000000000).toString();
    const installId = Math.floor(Math.random() * 1000000000000000000).toString().padStart(19, '0');
    const extractorArgs = `webpage_download_timeout=90,device_id=${deviceId},app_info=${installId},verify_fp=`;
    
    if (os.platform() === "win32") {
      parts.push(`--extractor-args "tiktok:${extractorArgs}"`);
    } else {
      parts.push(`--extractor-args 'tiktok:${extractorArgs.replace(/'/g, "'\\''")}'`);
    }

    // Additional TikTok-specific options
    parts.push("--sleep-interval", "2"); // Sleep 2 seconds between requests
    parts.push("--max-sleep-interval", "5"); // Random sleep up to 5 seconds
    parts.push("--sleep-subtitles", "1"); // Sleep 1 second for subtitles
    parts.push("--no-warnings"); // Reduce noise
  } else {
    // Non-TikTok platforms - add platform-specific options
    const isYouTube = urlLower.includes("youtube.com") || urlLower.includes("youtu.be");
    const isInstagram = urlLower.includes("instagram.com");
    const isPinterest = urlLower.includes("pinterest.com");
    const isVimeo = urlLower.includes("vimeo.com");
    const isReddit = urlLower.includes("reddit.com");
    const isTwitch = urlLower.includes("twitch.tv");
    
    // YouTube-specific options (handle age-restricted videos)
    if (isYouTube) {
      parts.push("--no-check-age"); // Don't check age restrictions
      parts.push("--no-warnings");
      parts.push("--extractor-args", "youtube:player_client=web"); // Use web client (no sign-in needed)
    }
    
    // Instagram-specific options
    if (isInstagram) {
      parts.push("--no-warnings");
      parts.push("--extractor-args", "instagram:webpage_download_timeout=60");
    }
    
    // Pinterest-specific options
    if (isPinterest) {
      parts.push("--no-warnings");
    }
    
    // Vimeo-specific options
    if (isVimeo) {
      parts.push("--no-warnings");
      parts.push("--referer", "https://vimeo.com/");
    }
    
    // Reddit-specific options
    if (isReddit) {
      parts.push("--no-warnings");
      parts.push("--extractor-args", "reddit:webpage_download_timeout=60");
    }
    
    // Twitch-specific options
    if (isTwitch) {
      parts.push("--no-warnings");
      parts.push("--referer", "https://www.twitch.tv/");
    }
    
    // Default for other platforms
    if (!isYouTube && !isInstagram && !isPinterest && !isVimeo && !isReddit && !isTwitch) {
      parts.push("--no-warnings");
    }
  }
  
  // Speed optimizations - download fragments concurrently for faster downloads
  // Use equals sign format to ensure proper argument parsing
  parts.push("--concurrent-fragments=4"); // Download 4 fragments simultaneously (speeds up downloads significantly)
  parts.push("--no-part"); // Don't use .part files (faster, but less resumable)
  parts.push("--hls-prefer-native"); // Use native HLS downloader when possible (faster)
  // Note: Removed --external-downloader-args as it can cause parsing issues

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

  // Note: We don't use --print here because it can interfere with output parsing
  // Instead, we rely on directory scanning to find the downloaded file

  // Add URL with proper escaping (always last)
  parts.push(escapeUrl(url));

  return parts.join(" ");
}

