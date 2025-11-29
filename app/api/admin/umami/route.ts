import { NextRequest, NextResponse } from "next/server";

const UMAMI_API_KEY = process.env.UMAMI_API_KEY;
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || "5d7c0418-ad3d-43b6-be7e-b3ff326e86b7";
// Umami Cloud uses api.umami.is/v1, not cloud.umami.is/api
const UMAMI_API_BASE_URL = process.env.UMAMI_API_BASE_URL || "https://api.umami.is/v1";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    if (!UMAMI_API_KEY) {
      console.error("[Umami API] API key not found in environment variables");
      return NextResponse.json(
        { error: "Umami API key not configured" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Log API key presence (but not the actual key for security)
    console.log("[Umami API] API key found:", UMAMI_API_KEY ? `${UMAMI_API_KEY.substring(0, 10)}...` : "NOT FOUND");
    console.log("[Umami API] Website ID:", UMAMI_WEBSITE_ID);
    console.log("[Umami API] Base URL:", UMAMI_API_BASE_URL);

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "all"; // 'stats', 'events', or 'all'
    let startAt = searchParams.get("startAt");
    let endAt = searchParams.get("endAt");

    // Umami API requires date parameters - default to last 365 days if not provided
    const now = Date.now();
    if (!startAt) {
      // Default to 1 year ago if not specified
      startAt = (now - 365 * 24 * 60 * 60 * 1000).toString();
    }
    if (!endAt) {
      endAt = now.toString();
    }

    const results: any = {};

    // Fetch events (this includes both pageviews and custom events)
    // We'll parse pageviews from events with eventType: 1
    // and custom events (downloads) from events with eventType: 2 and eventName set
    if (type === "all" || type === "stats" || type === "events") {
      try {
        // Try the events endpoint - this should return all events including custom events
        const eventsUrl = `${UMAMI_API_BASE_URL}/websites/${UMAMI_WEBSITE_ID}/events`;
        const eventsParams = new URLSearchParams();
        eventsParams.append("startAt", startAt);
        eventsParams.append("endAt", endAt);
        // Add unit parameter if needed (day, hour, etc.)
        // eventsParams.append("unit", "day");

        // Always include date parameters to avoid 500 error
        const fullEventsUrl = `${eventsUrl}?${eventsParams.toString()}`;
        console.log("[Umami API] Fetching events from:", fullEventsUrl.replace(UMAMI_API_KEY, "***"));

        // Umami Cloud uses x-umami-api-key header, not Authorization Bearer
        const eventsResponse = await fetch(
          fullEventsUrl,
          {
            headers: {
              "x-umami-api-key": UMAMI_API_KEY,
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          console.log("[Umami API] Full response structure:", JSON.stringify(eventsData, null, 2).substring(0, 2000));
          
          const events = eventsData.data || eventsData || [];
          const totalCount = eventsData.count || events.length;
          console.log("[Umami API] Events fetch successful, found", events.length, "events (total:", totalCount, ")");
          console.log("[Umami API] Response keys:", Object.keys(eventsData));

          // Parse pageviews (eventType: 1) and custom events (eventType: 2 with eventName)
          let pageviews = 0;
          let videoDownloads = 0;
          let audioDownloads = 0;

          // Debug: log ALL events to see structure
          console.log("[Umami API] Total events to parse:", events.length);
          events.forEach((event: any, index: number) => {
            console.log(`[Umami API] Event ${index + 1}:`, JSON.stringify(event, null, 2));
          });

          events.forEach((event: any) => {
            // eventType: 1 = pageview, eventType: 2 = custom event
            // Also check for different possible field names
            const eventType = event.eventType || event.type || event.event_type;
            const eventName = event.eventName || event.name || event.event_name || event.data?.name;
            
            console.log("[Umami API] Processing event - eventType:", eventType, "eventName:", eventName, "full event:", JSON.stringify(event));
            
            if (eventType === 1 || (!eventType && !eventName)) {
              // Pageview: eventType 1 or no eventType/eventName
              pageviews++;
              console.log("[Umami API] Counted as pageview");
            } else if (eventType === 2 || eventName) {
              // Custom event: eventType 2 or has eventName
              if (eventName && eventName !== "") {
                console.log("[Umami API] Found custom event:", eventName, "eventType:", eventType, "id:", event.id);
                if (eventName === "Download Video") {
                  videoDownloads++;
                  console.log("[Umami API] ✓ Counted video download");
                } else if (eventName === "Download Audio") {
                  audioDownloads++;
                  console.log("[Umami API] ✓ Counted audio download");
                } else {
                  // Log other custom events for debugging
                  console.log("[Umami API] Other custom event:", eventName);
                }
              } else {
                // Log events with eventType 2 but no eventName
                console.log("[Umami API] Event with eventType 2 but no eventName:", JSON.stringify(event, null, 2));
              }
            } else {
              // Log unexpected event types
              console.log("[Umami API] Unexpected event - eventType:", eventType, "eventName:", eventName, "full:", JSON.stringify(event));
            }
          });

          // If there are more pages, fetch them (Umami API paginates at 20 per page)
          if (totalCount > events.length && eventsData.pageSize) {
            const totalPages = Math.ceil(totalCount / eventsData.pageSize);
            console.log("[Umami API] Fetching additional pages. Total pages:", totalPages);
            
            for (let page = 2; page <= totalPages; page++) {
              try {
                const pageParams = new URLSearchParams();
                if (startAt) pageParams.append("startAt", startAt);
                if (endAt) pageParams.append("endAt", endAt);
                pageParams.append("page", page.toString());
                
                const pageResponse = await fetch(
                  `${eventsUrl}?${pageParams.toString()}`,
                  {
                    headers: {
                      "x-umami-api-key": UMAMI_API_KEY,
                      Accept: "application/json",
                    },
                    cache: "no-store",
                  }
                );
                
                if (pageResponse.ok) {
                  const pageData = await pageResponse.json();
                  const pageEvents = pageData.data || [];
                  console.log("[Umami API] Fetched page", page, "with", pageEvents.length, "events");
                  
                  pageEvents.forEach((event: any) => {
                    const eventType = event.eventType || event.type || event.event_type;
                    const eventName = event.eventName || event.name || event.event_name || event.data?.name;
                    
                    if (eventType === 1 || (!eventType && !eventName)) {
                      pageviews++;
                    } else if ((eventType === 2 || eventName) && eventName) {
                      if (eventName === "Download Video") {
                        videoDownloads++;
                      } else if (eventName === "Download Audio") {
                        audioDownloads++;
                      }
                    }
                  });
                }
              } catch (error) {
                console.error("[Umami API] Error fetching page", page, ":", error);
              }
            }
          }

          results.events = eventsData;
          results.pageviews = pageviews;
          results.videoDownloads = videoDownloads;
          results.audioDownloads = audioDownloads;
          console.log("[Umami API] Final parsed counts:", { pageviews, videoDownloads, audioDownloads });
        } else {
          const errorText = await eventsResponse.text();
          console.error("[Umami API] Events fetch failed:", eventsResponse.status, errorText.substring(0, 500));
          
          // Try to parse error for more details
          try {
            const errorData = JSON.parse(errorText);
            console.error("[Umami API] Error details:", errorData);
          } catch {
            // Error text is not JSON
          }
          
          // Return empty results instead of failing completely
          results.pageviews = 0;
          results.videoDownloads = 0;
          results.audioDownloads = 0;
          results.events = [];
          results.error = `API returned ${eventsResponse.status}: ${errorText.substring(0, 200)}`;
        }
      } catch (error) {
        console.error("[Umami API] Events fetch error:", error);
      }
    }


    return NextResponse.json(results, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("[Umami API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Umami data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

