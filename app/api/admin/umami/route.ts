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
          
          // Handle different response structures
          let events: any[] = [];
          let totalCount = 0;
          
          if (Array.isArray(eventsData)) {
            // Response is directly an array
            events = eventsData;
            totalCount = events.length;
          } else if (eventsData.data && Array.isArray(eventsData.data)) {
            // Response has data array
            events = eventsData.data;
            totalCount = eventsData.count || events.length;
          } else if (eventsData.events && Array.isArray(eventsData.events)) {
            // Response has events array
            events = eventsData.events;
            totalCount = eventsData.count || events.length;
          } else {
            // Try to find any array in the response
            const arrayKey = Object.keys(eventsData).find(key => Array.isArray(eventsData[key]));
            if (arrayKey) {
              events = eventsData[arrayKey];
              totalCount = events.length;
            }
          }
          
          console.log("[Umami API] Events fetch successful, found", events.length, "events (total:", totalCount, ")");
          console.log("[Umami API] Response structure - keys:", Object.keys(eventsData), "isArray:", Array.isArray(eventsData));

          // Parse pageviews (eventType: 1) and custom events (eventType: 2 with eventName)
          let pageviews = 0;
          let videoDownloads = 0;
          let audioDownloads = 0;

          // Parse events - check multiple possible structures
          console.log("[Umami API] Total events to parse:", events.length);
          
          // Log first few events for debugging (but not all to avoid spam)
          if (events.length > 0) {
            console.log("[Umami API] Sample events (first 3):", JSON.stringify(events.slice(0, 3), null, 2));
          }

          events.forEach((event: any) => {
            // Check multiple possible field names and structures
            const eventType = event.eventType || event.type || event.event_type || event.event_type;
            const eventName = event.eventName || event.name || event.event_name || 
                            event.data?.name || event.data?.eventName || 
                            event.event?.name || event.event?.eventName ||
                            (typeof event.data === 'string' ? event.data : null);
            
            // If event has a data field that's an object, check it thoroughly
            let dataEventName = null;
            if (event.data && typeof event.data === 'object') {
              dataEventName = event.data.name || event.data.eventName || event.data.value;
            }
            const finalEventName = eventName || dataEventName;
            
            // Determine if it's a pageview or custom event
            const isPageview = eventType === 1 || (!eventType && !finalEventName);
            const isCustomEvent = eventType === 2 || (finalEventName && finalEventName !== "");
            
            if (isPageview) {
              pageviews++;
            } else if (isCustomEvent && finalEventName) {
              // Custom event with name
              if (finalEventName === "Download Video") {
                videoDownloads++;
                console.log("[Umami API] ✓ Video download counted");
              } else if (finalEventName === "Download Audio") {
                audioDownloads++;
                console.log("[Umami API] ✓ Audio download counted");
              } else {
                // Log other custom events (but limit to avoid spam)
                if (videoDownloads + audioDownloads < 5) {
                  console.log("[Umami API] Other custom event:", finalEventName);
                }
              }
            } else {
              // Unknown event structure - log first few for debugging
              if (pageviews + videoDownloads + audioDownloads < 5) {
                console.log("[Umami API] Unknown event structure:", {
                  eventType,
                  eventName: finalEventName,
                  hasData: !!event.data,
                  keys: Object.keys(event)
                });
              }
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
                    // Use same parsing logic as main events
                    const eventType = event.eventType || event.type || event.event_type;
                    const eventName = event.eventName || event.name || event.event_name || 
                                    event.data?.name || event.data?.eventName || 
                                    event.event?.name || event.event?.eventName ||
                                    (typeof event.data === 'string' ? event.data : null);
                    
                    let dataEventName = null;
                    if (event.data && typeof event.data === 'object') {
                      dataEventName = event.data.name || event.data.eventName || event.data.value;
                    }
                    const finalEventName = eventName || dataEventName;
                    
                    const isPageview = eventType === 1 || (!eventType && !finalEventName);
                    const isCustomEvent = eventType === 2 || (finalEventName && finalEventName !== "");
                    
                    if (isPageview) {
                      pageviews++;
                    } else if (isCustomEvent && finalEventName) {
                      if (finalEventName === "Download Video") {
                        videoDownloads++;
                      } else if (finalEventName === "Download Audio") {
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
          console.log("[Umami API] ✓ Final parsed counts:", { 
            pageviews, 
            videoDownloads, 
            audioDownloads,
            totalEvents: events.length 
          });
          
          // Log summary of what we found
          if (videoDownloads > 0 || audioDownloads > 0) {
            console.log("[Umami API] ✓ SUCCESS: Found download events!", {
              video: videoDownloads,
              audio: audioDownloads
            });
          } else if (events.length > 0) {
            console.log("[Umami API] ⚠ WARNING: Found", events.length, "events but no downloads detected. Check event structure above.");
          }
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

