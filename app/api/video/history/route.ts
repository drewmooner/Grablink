// API route for download history

import { NextRequest, NextResponse } from "next/server";
import { getHistory, clearHistory, deleteHistoryEntry } from "@/lib/services/history";
import type { HistoryResponse } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Get download history
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Get client IP for history tracking
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                     request.headers.get("x-real-ip") || 
                     "unknown";

    const history = await getHistory(clientIp, limit);

    return NextResponse.json<HistoryResponse>(
      {
        success: true,
        history,
        total: history.length,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json<HistoryResponse>(
      {
        success: false,
        history: [],
        total: 0,
      },
      { status: 500 }
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
        { status: 400 }
      );
    }

    // Get client IP
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                     request.headers.get("x-real-ip") || 
                     "unknown";

    const deleted = await deleteHistoryEntry(id, clientIp);

    if (deleted) {
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      return NextResponse.json(
        { success: false, error: "History entry not found" },
        { status: 404 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
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
      // Get client IP
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                       request.headers.get("x-real-ip") || 
                       "unknown";

      await clearHistory(clientIp);

      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action. Use { action: 'clear' }" },
        { status: 400 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

