import { NextResponse } from "next/server";

/**
 * Test endpoint to verify Umami tracking setup
 * Access: GET /api/admin/umami/test
 */
export const runtime = "nodejs";

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    checks: {},
    status: "unknown",
  };

  // Check 1: Environment variables
  const UMAMI_API_KEY = process.env.UMAMI_API_KEY;
  const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || "5d7c0418-ad3d-43b6-be7e-b3ff326e86b7";
  const UMAMI_API_BASE_URL = process.env.UMAMI_API_BASE_URL || "https://api.umami.is/v1";

  results.checks.env = {
    apiKey: UMAMI_API_KEY ? `${UMAMI_API_KEY.substring(0, 10)}...` : "NOT SET",
    websiteId: UMAMI_WEBSITE_ID,
    apiBaseUrl: UMAMI_API_BASE_URL,
    apiKeySet: !!UMAMI_API_KEY,
  };

  // Check 2: Test API connection
  if (UMAMI_API_KEY) {
    try {
      // Add date parameters to get recent events (last 30 days)
      const now = Date.now();
      const startAt = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago
      const testUrl = `${UMAMI_API_BASE_URL}/websites/${UMAMI_WEBSITE_ID}/events?startAt=${startAt}&endAt=${now}`;
      const response = await fetch(testUrl, {
        headers: {
          "x-umami-api-key": UMAMI_API_KEY,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      results.checks.api = {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      };

      if (response.ok) {
        const data = await response.json();
        const events = data.data || data || [];
        const totalCount = data.count || events.length;

        // Count events
        let pageviews = 0;
        let videoDownloads = 0;
        let audioDownloads = 0;

        events.forEach((event: any) => {
          // Check multiple possible field names
          const eventType = event.eventType || event.type || event.event_type;
          const eventName = event.eventName || event.name || event.event_name || event.data?.name;
          
          console.log("[Test] Event:", JSON.stringify(event, null, 2));
          console.log("[Test] Parsed - eventType:", eventType, "eventName:", eventName);
          
          if (eventType === 1 || (!eventType && !eventName)) {
            pageviews++;
          } else if (eventName === "Download Video") {
            videoDownloads++;
          } else if (eventName === "Download Audio") {
            audioDownloads++;
          }
        });

        results.checks.api.data = {
          totalEvents: totalCount,
          eventsInResponse: events.length,
          pageviews,
          videoDownloads,
          audioDownloads,
          sampleEvent: events[0] || null,
          allEvents: events.slice(0, 10), // First 10 events for debugging
          fullResponse: data, // Full response structure
        };

        results.status = "success";
      } else {
        const errorText = await response.text();
        results.checks.api.error = errorText.substring(0, 200);
        results.status = "api_error";
      }
    } catch (error) {
      results.checks.api = {
        error: error instanceof Error ? error.message : "Unknown error",
      };
      results.status = "connection_error";
    }
  } else {
    results.status = "missing_api_key";
  }

  // Check 3: Frontend script configuration
  results.checks.frontend = {
    scriptUrl: "https://cloud.umami.is/script.js",
    websiteId: "5d7c0418-ad3d-43b6-be7e-b3ff326e86b7",
    note: "Check browser console for window.umami function",
  };

  return NextResponse.json(results, {
    status: results.status === "success" ? 200 : 500,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

