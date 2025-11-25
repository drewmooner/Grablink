// Health check endpoint to verify system dependencies
import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET() {
  const checks: Record<string, { available: boolean; version?: string; error?: string }> = {};

  // Check Python
  try {
    const { stdout } = await execAsync("python3 --version", { timeout: 5000 });
    checks.python = { available: true, version: stdout.trim() };
  } catch (error: any) {
    try {
      const { stdout } = await execAsync("python --version", { timeout: 5000 });
      checks.python = { available: true, version: stdout.trim() };
    } catch (error2: any) {
      checks.python = { 
        available: false, 
        error: error2.code === "ENOENT" ? "Python not found in PATH" : error2.message 
      };
    }
  }

  // Check yt-dlp
  try {
    const { stdout } = await execAsync("yt-dlp --version", { timeout: 5000 });
    checks.ytdlp = { available: true, version: stdout.trim() };
  } catch (error: any) {
    checks.ytdlp = { 
      available: false, 
      error: error.code === "ENOENT" ? "yt-dlp not found in PATH. Install with: pip install yt-dlp" : error.message 
    };
  }

  // Check FFmpeg
  try {
    const { stdout } = await execAsync("ffmpeg -version", { timeout: 5000 });
    const versionMatch = stdout.match(/ffmpeg version (\S+)/);
    checks.ffmpeg = { available: true, version: versionMatch ? versionMatch[1] : "installed" };
  } catch (error: any) {
    checks.ffmpeg = { 
      available: false, 
      error: error.code === "ENOENT" ? "FFmpeg not found in PATH" : error.message 
    };
  }

  const allAvailable = Object.values(checks).every(check => check.available);

  return NextResponse.json({
    status: allAvailable ? "healthy" : "unhealthy",
    checks,
    timestamp: new Date().toISOString(),
  }, {
    status: allAvailable ? 200 : 503,
  });
}

