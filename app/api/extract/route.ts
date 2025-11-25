// API route for extracting links from URLs

import { NextRequest, NextResponse } from "next/server";
import { extractLinksFromUrl } from "@/lib/scraper";
import type { ExtractRequest, ExtractResponse } from "@/lib/types";
import { isValidUrl } from "@/lib/utils/url";

export async function POST(request: NextRequest) {
  let requestUrl = "";

  try {
    const body: ExtractRequest = await request.json();
    const { url, options } = body;
    requestUrl = url || "";

    // Validate request
    if (!url || typeof url !== "string") {
      return NextResponse.json<ExtractResponse>(
        {
          success: false,
          url: requestUrl,
          links: [],
          totalLinks: 0,
          error: "URL is required and must be a string",
        },
        { status: 400 }
      );
    }

    // Validate URL format
    if (!isValidUrl(url)) {
      return NextResponse.json<ExtractResponse>(
        {
          success: false,
          url,
          links: [],
          totalLinks: 0,
          error: "Invalid URL format. Please provide a valid HTTP or HTTPS URL",
        },
        { status: 400 }
      );
    }

    // Extract links
    const result = await extractLinksFromUrl({
      url,
      options: {
        includeMetadata: options?.includeMetadata ?? true,
        filterDuplicates: options?.filterDuplicates ?? true,
        maxLinks: options?.maxLinks,
      },
    });

    return NextResponse.json<ExtractResponse>(result, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json<ExtractResponse>(
      {
        success: false,
        url: requestUrl,
        links: [],
        totalLinks: 0,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Also support GET requests with URL as query parameter
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json<ExtractResponse>(
        {
          success: false,
          url: "",
          links: [],
          totalLinks: 0,
          error: "URL query parameter is required",
        },
        { status: 400 }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json<ExtractResponse>(
        {
          success: false,
          url,
          links: [],
          totalLinks: 0,
          error: "Invalid URL format. Please provide a valid HTTP or HTTPS URL",
        },
        { status: 400 }
      );
    }

    const includeMetadata = searchParams.get("includeMetadata") === "true";
    const filterDuplicates = searchParams.get("filterDuplicates") !== "false";
    const maxLinks = searchParams.get("maxLinks")
      ? parseInt(searchParams.get("maxLinks")!, 10)
      : undefined;

    const result = await extractLinksFromUrl({
      url,
      options: {
        includeMetadata,
        filterDuplicates,
        maxLinks,
      },
    });

    return NextResponse.json<ExtractResponse>(result, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json<ExtractResponse>(
      {
        success: false,
        url: request.nextUrl.searchParams.get("url") || "",
        links: [],
        totalLinks: 0,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

