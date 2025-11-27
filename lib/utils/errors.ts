// Error handling utilities

export class ExtractionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Parse yt-dlp error messages and return specific error codes
 */
export function parseYtDlpError(error: string | any): { code: string; message: string } {
  // Handle error objects (from execAsync)
  let errorMessage: string;
  let errorCode: number | string | undefined;
  
  if (typeof error !== "string") {
    errorCode = error?.code;
    errorMessage = error?.stderr || error?.stdout || error?.message || String(error);
  } else {
    errorMessage = error;
  }
  
  const errorLower = errorMessage.toLowerCase();
  
  // Check for command not found by error code (most reliable)
  if (errorCode === 9009 || errorCode === 127 || errorCode === "ENOENT") {
    return {
      code: "COMMAND_NOT_FOUND",
      message: "yt-dlp or Python is not installed on the server. Please contact support.",
    };
  }
  
  // Check for command not found in error message
  if (
    errorLower.includes("command not found") ||
    errorLower.includes("python was not found") ||
    errorLower.includes("python3 was not found") ||
    errorLower.includes("python: command not found") ||
    errorLower.includes("python3: command not found") ||
    errorLower.includes("yt-dlp: command not found") ||
    errorLower.includes("no such file or directory") ||
    errorLower.includes("cannot find") ||
    errorLower.includes("is not recognized")
  ) {
    return {
      code: "COMMAND_NOT_FOUND",
      message: "yt-dlp or Python is not installed on the server. Please contact support.",
    };
  }
  
  // Handle TikTok-specific errors with friendly messages
  if (errorLower.includes("tiktok") || errorLower.includes("unable to extract webpage") || errorLower.includes("video not available")) {
    if (errorLower.includes("rate limit") || errorLower.includes("too many requests") || errorLower.includes("429")) {
      return {
        code: "TIKTOK_RATE_LIMIT",
        message: "TikTok is being tricky right now. Please try again in a minute.",
      };
    }
    if (errorLower.includes("private") || errorLower.includes("not available")) {
      return {
        code: "TIKTOK_PRIVATE",
        message: "This TikTok video is private or not available.",
      };
    }
    return {
      code: "TIKTOK_ERROR",
      message: "TikTok is being tricky, try again in a minute.",
    };
  }

  if (errorLower.includes("video unavailable") || errorLower.includes("private video")) {
    return {
      code: "VIDEO_NOT_FOUND",
      message: "Video is unavailable, private, or has been deleted",
    };
  }

  if (errorLower.includes("age-restricted") || errorLower.includes("sign in")) {
    return {
      code: "AGE_RESTRICTED",
      message: "Video is age-restricted or requires sign-in",
    };
  }

  if (errorLower.includes("unavailable") || errorLower.includes("not found")) {
    return {
      code: "VIDEO_NOT_FOUND",
      message: "Video not found or unavailable",
    };
  }

  if (errorLower.includes("network") || errorLower.includes("connection")) {
    return {
      code: "NETWORK_ERROR",
      message: "Network error - could not connect to video source",
    };
  }

  if (errorLower.includes("timeout")) {
    return {
      code: "TIMEOUT",
      message: "Request timed out - the server took too long to respond",
    };
  }

  if (errorLower.includes("format") || errorLower.includes("quality")) {
    return {
      code: "UNSUPPORTED_QUALITY",
      message: "Requested quality or format is not available",
    };
  }


  if (errorLower.includes("rate limit") || errorLower.includes("too many requests")) {
    return {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Rate limit exceeded - too many requests",
    };
  }

  return {
    code: "EXTRACTION_FAILED",
    message: error || "Failed to extract video",
  };
}

/**
 * Parse FFmpeg error messages
 */
export function parseFFmpegError(error: string): { code: string; message: string } {
  const errorLower = error.toLowerCase();

  if (errorLower.includes("no such file") || errorLower.includes("cannot find")) {
    return {
      code: "FILE_NOT_FOUND",
      message: "Video file not found for audio extraction",
    };
  }

  if (errorLower.includes("invalid data") || errorLower.includes("corrupt")) {
    return {
      code: "INVALID_VIDEO",
      message: "Video file is corrupted or invalid",
    };
  }

  if (errorLower.includes("codec") || errorLower.includes("format")) {
    return {
      code: "UNSUPPORTED_FORMAT",
      message: "Video format is not supported for audio extraction",
    };
  }

  return {
    code: "AUDIO_EXTRACTION_FAILED",
    message: error || "Failed to extract audio from video",
  };
}

