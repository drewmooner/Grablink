// API route for download history

import { NextRequest, NextResponse } from "next/server";
import { getHistory, clearHistory, deleteHistoryEntry } from "@/lib/services/history";
import type { HistoryResponse } from "@/lib/types";

export const runtime = "nodejs";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle OPTIONS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * Get download history
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Get client IP and User-Agent for history tracking
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                     request.headers.get("x-real-ip") || 
                     "unknown";
    const userAgent = request.headers.get("user-agent") || "";

    const history = await getHistory(clientIp, limit, userAgent);

    return NextResponse.json<HistoryResponse>(
      {
        success: true,
        history,
        total: history.length,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    // Log error for debugging but return empty history
    console.error("[history/GET] Error getting history:", error);
    return NextResponse.json<HistoryResponse>(
      {
        success: false,
        history: [],
        total: 0,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Delete history entry
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID parameter is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get client IP and User-Agent
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                     request.headers.get("x-real-ip") || 
                     "unknown";
    const userAgent = request.headers.get("user-agent") || "";

    const deleted = await deleteHistoryEntry(id, clientIp, userAgent);

    if (deleted) {
      return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
    } else {
      return NextResponse.json(
        { success: false, error: "History entry not found" },
        { status: 404, headers: corsHeaders }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Clear all history
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === "clear") {
      // Get client IP and User-Agent
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                       request.headers.get("x-real-ip") || 
                       "unknown";
      const userAgent = request.headers.get("user-agent") || "";

      await clearHistory(clientIp, userAgent);

      return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action. Use { action: 'clear' }" },
        { status: 400, headers: corsHeaders }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}

