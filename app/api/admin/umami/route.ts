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

    // Umami API requires date parameters - default to ALL events if not provided
    const now = Date.now();
    if (!startAt) {
      // Default to beginning of time (0) to get ALL past events
      startAt = "0";
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
          const events = eventsData.data || eventsData || [];
          const totalCount = eventsData.count || events.length;
          console.log("[Umami API] Events fetch successful, found", events.length, "events (total:", totalCount, ")");
          console.log("[Umami API] Date range:", {
            startAt: startAt === "0" ? "Beginning of time (ALL events)" : new Date(parseInt(startAt)).toISOString(),
            endAt: new Date(parseInt(endAt)).toISOString(),
            range: startAt === "0" ? "ALL PAST EVENTS" : `${Math.round((parseInt(endAt) - parseInt(startAt)) / (1000 * 60 * 60 * 24))} days`
          });

          // Parse pageviews (eventType: 1) and custom events (eventType: 2 with eventName)
          let pageviews = 0;
          let videoDownloads = 0;
          let audioDownloads = 0;

          // Debug: log first few events to see structure
          if (events.length > 0) {
            console.log("[Umami API] Sample event structure:", JSON.stringify(events[0], null, 2));
          }

          events.forEach((event: any) => {
            // eventType: 1 = pageview, eventType: 2 = custom event
            const eventType = event.eventType;
            const eventName = event.eventName || event.name || "";
            
            if (eventType === 1) {
              // Pageview event
              pageviews++;
            } else if (eventType === 2) {
              // Custom events have eventType: 2
              if (eventName && eventName.trim() !== "") {
                const normalizedName = eventName.trim();
                if (normalizedName === "Download Video") {
                  videoDownloads++;
                  console.log("[Umami API] ✓ Video download found - ID:", event.id);
                } else if (normalizedName === "Download Audio") {
                  audioDownloads++;
                  console.log("[Umami API] ✓ Audio download found - ID:", event.id);
                }
              }
            }
          });

          // If there are more pages, fetch them (Umami API paginates at 20 per page)
          // IMPORTANT: Always fetch ALL pages to get accurate counts
          let totalEventsProcessed = events.length;
          
          if (totalCount > events.length) {
            const pageSize = eventsData.pageSize || 20;
            const totalPages = Math.ceil(totalCount / pageSize);
            console.log("[Umami API] Fetching additional pages. Total events:", totalCount, "Page size:", pageSize, "Total pages:", totalPages);
            
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
                  const pageEvents = pageData.data || pageData || [];
                  totalEventsProcessed += pageEvents.length;
                  console.log("[Umami API] Fetched page", page, "/", totalPages, "with", pageEvents.length, "events (total processed:", totalEventsProcessed, "/", totalCount, ")");
                  
                  pageEvents.forEach((event: any) => {
                    // eventType: 1 = pageview, eventType: 2 = custom event
                    const eventType = event.eventType;
                    const eventName = event.eventName || event.name || "";
                    
                    if (eventType === 1) {
                      pageviews++;
                    } else if (eventType === 2) {
                      // Custom events have eventType: 2
                      if (eventName && eventName.trim() !== "") {
                        const normalizedName = eventName.trim();
                        if (normalizedName === "Download Video") {
                          videoDownloads++;
                        } else if (normalizedName === "Download Audio") {
                          audioDownloads++;
                        }
                      }
                    }
                  });
                } else {
                  const errorText = await pageResponse.text().catch(() => "Unknown error");
                  console.error("[Umami API] Failed to fetch page", page, ":", pageResponse.status, errorText.substring(0, 200));
                }
              } catch (error) {
                console.error("[Umami API] Error fetching page", page, ":", error);
              }
            }
            
            console.log("[Umami API] Finished fetching all pages. Events processed:", totalEventsProcessed, "/", totalCount, "Final counts:", { pageviews, videoDownloads, audioDownloads });
            
            // Verify we processed all events
            if (totalEventsProcessed < totalCount) {
              console.warn("[Umami API] ⚠️ Warning: Processed", totalEventsProcessed, "events but total count is", totalCount, "- some events may be missing");
            } else if (totalEventsProcessed > totalCount) {
              console.warn("[Umami API] ⚠️ Warning: Processed", totalEventsProcessed, "events but total count is", totalCount, "- possible duplicate counting");
            } else {
              console.log("[Umami API] ✅ Successfully processed all", totalCount, "events");
            }
          } else {
            console.log("[Umami API] ✅ All events fetched in single page:", totalCount);
          }

          results.events = eventsData;
          results.pageviews = pageviews;
          results.videoDownloads = videoDownloads;
          results.audioDownloads = audioDownloads;
          results.totalEvents = totalCount;
          results.eventsProcessed = totalEventsProcessed || events.length;
          
          // Safely parse date range for debugging
          try {
            const startAtNum = parseInt(startAt || "0", 10);
            const endAtNum = parseInt(endAt || now.toString(), 10);
            results.dateRange = {
              startAt: startAtNum,
              endAt: endAtNum,
              startDate: new Date(startAtNum).toISOString(),
              endDate: new Date(endAtNum).toISOString()
            };
          } catch (dateError) {
            console.warn("[Umami API] Failed to parse date range:", dateError);
            results.dateRange = {
              startAt: parseInt(startAt || "0", 10) || 0,
              endAt: parseInt(endAt || now.toString(), 10) || now
            };
          }
          
          console.log("[Umami API] Final parsed counts:", { 
            pageviews, 
            videoDownloads, 
            audioDownloads, 
            totalDownloads: videoDownloads + audioDownloads,
            totalEvents: totalCount,
            eventsProcessed: totalEventsProcessed || events.length,
            dateRange: results.dateRange,
            fetchingAllPastEvents: startAt === "0"
          });
          
          // Log summary for all-time requests
          if (startAt === "0") {
            console.log("[Umami API] 📊 ALL-TIME STATS SUMMARY:", {
              totalVideoDownloads: videoDownloads,
              totalAudioDownloads: audioDownloads,
              totalDownloads: videoDownloads + audioDownloads,
              totalPageviews: pageviews,
              totalEventsProcessed: totalEventsProcessed || events.length,
              status: totalEventsProcessed === totalCount ? "✅ Complete" : "⚠️ Partial"
            });
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

