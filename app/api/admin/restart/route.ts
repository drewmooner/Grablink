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
  // On Vercel, deployments are managed through the Vercel dashboard/CLI
  // This endpoint is kept for compatibility but doesn't perform actual restart
  return NextResponse.json(
    {
      success: false,
      error: "Service restart is not available on Vercel. To redeploy, use the Vercel dashboard or run 'vercel --prod' from the CLI.",
      note: "Vercel automatically redeploys on git push. For manual redeploy, use the Vercel dashboard.",
    },
    { status: 200, headers: corsHeaders }
  );
}

