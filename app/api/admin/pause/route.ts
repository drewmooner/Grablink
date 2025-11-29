import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";

const PAUSE_STATE_FILE = join(process.cwd(), ".pause-state.json");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const runtime = "nodejs";

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

async function getPauseState(): Promise<{ paused: boolean; message?: string }> {
  try {
    const data = await readFile(PAUSE_STATE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { paused: false };
  }
}

async function setPauseState(state: { paused: boolean; message?: string }): Promise<void> {
  try {
    await mkdir(process.cwd(), { recursive: true });
    await writeFile(PAUSE_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write pause state:", error);
    throw error;
  }
}

export async function GET() {
  try {
    const state = await getPauseState();
    return NextResponse.json(state, { status: 200, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { paused: false, error: "Failed to read pause state" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { paused, message } = body;

    if (typeof paused !== "boolean") {
      return NextResponse.json(
        { success: false, error: "paused must be a boolean" },
        { status: 400, headers: corsHeaders }
      );
    }

    await setPauseState({
      paused,
      message: message || (paused ? "We'll be back soon!" : undefined),
    });

    return NextResponse.json(
      { success: true, paused, message: message || (paused ? "We'll be back soon!" : undefined) },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update pause state" },
      { status: 500, headers: corsHeaders }
    );
  }
}

