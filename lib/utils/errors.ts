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
export function parseYtDlpError(error: string): { code: string; message: string } {
  const errorLower = error.toLowerCase();

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

