// API route for getting video info

import { NextRequest, NextResponse } from "next/server";
import { getVideoInfo } from "@/lib/services/videoExtractor";
import type { VideoInfoResponse } from "@/lib/types";
import { isValidUrl } from "@/lib/utils/url";
import { withRateLimit } from "@/lib/middleware/rateLimit";
import { detectPlatform } from "@/lib/utils/platform";

// Increase body size limit for this route
export const maxDuration = 120; // 2 minutes timeout (optimized: reduced from 180s for faster failure detection)
export const runtime = "nodejs";

async function handleInfo(request: NextRequest) {
  let url = "";
  try {
    // Safely parse request body
    let body: any = {};
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[handleInfo] Failed to parse request body:", parseError);
      return NextResponse.json<VideoInfoResponse>(
        {
          success: false,
          platform: "unknown",
          url: "",
          qualities: [],
          downloadOptions: {
            recommendedMethod: "proxy",
            supportsDirect: false,
            supportsStreaming: true,
          },
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid request body. Expected JSON with 'url' field.",
          },
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }
    url = body.url || "";

    // Validate request
    if (!url || typeof url !== "string") {
      return NextResponse.json<VideoInfoResponse>(
        {
          success: false,
          platform: "unknown",
          url: url || "",
          qualities: [],
          downloadOptions: {
            recommendedMethod: "proxy",
            supportsDirect: false,
            supportsStreaming: true,
          },
          error: {
            code: "INVALID_URL",
            message: "URL is required and must be a string",
          },
        },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    // Smart URL validation and normalization
    let normalizedUrl = url.trim();
    
    // Try to normalize the URL (add https:// if missing)
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      // Check if it looks like a URL (has a domain)
      if (normalizedUrl.includes(".") && !normalizedUrl.includes(" ")) {
        normalizedUrl = "https://" + normalizedUrl;
      }
    }
    
    // Validate URL format
    if (!isValidUrl(normalizedUrl)) {
      return NextResponse.json<VideoInfoResponse>(
        {
          success: false,
          platform: "unknown",
          url: normalizedUrl,
          qualities: [],
          downloadOptions: {
            recommendedMethod: "proxy",
            supportsDirect: false,
            supportsStreaming: true,
          },
          error: {
            code: "INVALID_URL",
            message: `Invalid URL format: "${url}". Please provide a valid HTTP or HTTPS URL`,
          },
        },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }
    
    // Use normalized URL for processing
    url = normalizedUrl;

    // Get video info with error handling
    let result: VideoInfoResponse;
    try {
      result = await getVideoInfo(url);
    } catch (extractionError) {
      console.error("[handleInfo] Video extraction error:", extractionError);
      const errorMessage = extractionError instanceof Error ? extractionError.message : "Failed to extract video information";
      result = {
        success: false,
        platform: detectPlatform(url),
        url,
        qualities: [],
        downloadOptions: {
          recommendedMethod: "proxy",
          supportsDirect: false,
          supportsStreaming: true,
        },
        error: {
          code: "EXTRACTION_ERROR",
          message: errorMessage,
        },
      };
    }

    return NextResponse.json<VideoInfoResponse>(result, {
      status: result.success ? 200 : 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    // Log the full error for debugging
    console.error("[handleInfo] Error getting video info:", error);
    if (error instanceof Error) {
      console.error("[handleInfo] Error stack:", error.stack);
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json<VideoInfoResponse>(
      {
        success: false,
        platform: "unknown",
        url: url || "",
        qualities: [],
        downloadOptions: {
          recommendedMethod: "proxy",
          supportsDirect: false,
          supportsStreaming: true,
        },
        error: {
          code: "SERVER_ERROR",
          message: errorMessage,
        },
        },
        { 
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Apply rate limiting (30 requests per hour per IP)
export async function POST(request: NextRequest) {
  try {
    return await withRateLimit(
      async (req: Request) => {
        try {
          const nextReq = req as unknown as NextRequest;
          return await handleInfo(nextReq);
        } catch (error) {
          console.error("[POST /api/video/info] Handler error:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          return NextResponse.json<VideoInfoResponse>(
            {
              success: false,
              platform: "unknown",
              url: "",
              qualities: [],
              downloadOptions: {
                recommendedMethod: "proxy",
                supportsDirect: false,
                supportsStreaming: true,
              },
              error: {
                code: "HANDLER_ERROR",
                message: errorMessage,
              },
            },
            {
              status: 500,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
              },
            }
          );
        }
      },
      { limit: 30, windowMs: 60 * 60 * 1000 } // 30 per hour
    )(request as unknown as Request);
  } catch (error) {
    console.error("[POST /api/video/info] Outer error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json<VideoInfoResponse>(
      {
        success: false,
        platform: "unknown",
        url: "",
        qualities: [],
        downloadOptions: {
          recommendedMethod: "proxy",
          supportsDirect: false,
          supportsStreaming: true,
        },
        error: {
          code: "RATE_LIMIT_ERROR",
          message: errorMessage,
        },
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

// Also support GET requests
async function handleInfoGet(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json<VideoInfoResponse>(
        {
          success: false,
          platform: "unknown",
          url: "",
          qualities: [],
          downloadOptions: {
            recommendedMethod: "proxy",
            supportsDirect: false,
            supportsStreaming: true,
          },
          error: {
            code: "INVALID_URL",
            message: "URL query parameter is required",
          },
        },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json<VideoInfoResponse>(
        {
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
            code: "INVALID_URL",
            message: "Invalid URL format. Please provide a valid HTTP or HTTPS URL",
          },
        },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    // Get video info with error handling
    let result: VideoInfoResponse;
    try {
      result = await getVideoInfo(url);
    } catch (extractionError) {
      console.error("[handleInfoGet] Video extraction error:", extractionError);
      const errorMessage = extractionError instanceof Error ? extractionError.message : "Failed to extract video information";
      result = {
        success: false,
        platform: detectPlatform(url),
        url,
        qualities: [],
        downloadOptions: {
          recommendedMethod: "proxy",
          supportsDirect: false,
          supportsStreaming: true,
        },
        error: {
          code: "EXTRACTION_ERROR",
          message: errorMessage,
        },
      };
    }

    return NextResponse.json<VideoInfoResponse>(result, {
      status: result.success ? 200 : 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("[handleInfoGet] Outer catch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json<VideoInfoResponse>(
      {
        success: false,
        platform: "unknown",
        url: request.nextUrl.searchParams.get("url") || "",
        qualities: [],
        downloadOptions: {
          recommendedMethod: "proxy",
          supportsDirect: false,
          supportsStreaming: true,
        },
        error: {
          code: "SERVER_ERROR",
          message: errorMessage,
        },
      },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

// Apply rate limiting to GET requests too
export async function GET(request: NextRequest) {
  try {
    return await withRateLimit(
      async (req: Request) => {
        try {
          const nextReq = req as unknown as NextRequest;
          return await handleInfoGet(nextReq);
        } catch (error) {
          console.error("[GET /api/video/info] Handler error:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          return NextResponse.json<VideoInfoResponse>(
            {
              success: false,
              platform: "unknown",
              url: "",
              qualities: [],
              downloadOptions: {
                recommendedMethod: "proxy",
                supportsDirect: false,
                supportsStreaming: true,
              },
              error: {
                code: "HANDLER_ERROR",
                message: errorMessage,
              },
            },
            {
              status: 500,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
              },
            }
          );
        }
      },
      { limit: 30, windowMs: 60 * 60 * 1000 } // 30 per hour
    )(request as unknown as Request);
  } catch (error) {
    console.error("[GET /api/video/info] Outer error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json<VideoInfoResponse>(
      {
        success: false,
        platform: "unknown",
        url: "",
        qualities: [],
        downloadOptions: {
          recommendedMethod: "proxy",
          supportsDirect: false,
          supportsStreaming: true,
        },
        error: {
          code: "RATE_LIMIT_ERROR",
          message: errorMessage,
        },
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}
