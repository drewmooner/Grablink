// API route for getting video info

import { NextRequest, NextResponse } from "next/server";
import { getVideoInfo } from "@/lib/services/videoExtractor";
import type { VideoInfoResponse } from "@/lib/types";
import { isValidUrl } from "@/lib/utils/url";
import { withRateLimit } from "@/lib/middleware/rateLimit";

// Increase body size limit for this route
export const maxDuration = 180; // 3 minutes timeout (increased for slow platforms)
export const runtime = "nodejs";

async function handleInfo(request: NextRequest) {
  let url = "";
  try {
    const body = await request.json();
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

    // Validate URL format
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

    // Get video info
    const result = await getVideoInfo(url);

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
  return withRateLimit(
    async (req: Request) => {
      const nextReq = req as unknown as NextRequest;
      return handleInfo(nextReq);
    },
    { limit: 30, windowMs: 60 * 60 * 1000 } // 30 per hour
  )(request as unknown as Request);
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

    const result = await getVideoInfo(url);

    return NextResponse.json<VideoInfoResponse>(result, {
      status: result.success ? 200 : 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
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
  return withRateLimit(
    async (req: Request) => {
      const nextReq = req as unknown as NextRequest;
      return handleInfoGet(nextReq);
    },
    { limit: 30, windowMs: 60 * 60 * 1000 } // 30 per hour
  )(request as unknown as Request);
}
