import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const runtime = "nodejs";

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;
    const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID;

    if (!RAILWAY_API_TOKEN || !RAILWAY_SERVICE_ID) {
      return NextResponse.json(
        {
          success: false,
          error: "Railway API credentials not configured. Set RAILWAY_API_TOKEN and RAILWAY_SERVICE_ID environment variables.",
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const response = await fetch(`https://api.railway.app/v1/services/${RAILWAY_SERVICE_ID}/restart`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RAILWAY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          success: false,
          error: `Railway API error: ${response.status} ${errorText}`,
        },
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.json().catch(() => ({}));

    return NextResponse.json(
      {
        success: true,
        message: "Service restart initiated",
        data,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to restart service: ${errorMessage}`,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

