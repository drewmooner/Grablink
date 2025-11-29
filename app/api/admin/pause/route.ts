import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Use /tmp on Vercel (writable), or project root on Railway
const getPauseStateFile = (): string => {
  // Check if we're on Vercel (read-only filesystem)
  if (process.env.VERCEL) {
    return join("/tmp", ".pause-state.json");
  }
  // Railway or local - use project root
  return join(process.cwd(), ".pause-state.json");
};

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
    const pauseFile = getPauseStateFile();
    if (existsSync(pauseFile)) {
      const data = await readFile(pauseFile, "utf-8");
      return JSON.parse(data);
    }
    return { paused: false };
  } catch (error) {
    console.error("Failed to read pause state:", error);
    return { paused: false };
  }
}

async function setPauseState(state: { paused: boolean; message?: string }): Promise<void> {
  try {
    const pauseFile = getPauseStateFile();
    const dir = process.env.VERCEL ? "/tmp" : process.cwd();
    await mkdir(dir, { recursive: true });
    await writeFile(pauseFile, JSON.stringify(state, null, 2), "utf-8");
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

