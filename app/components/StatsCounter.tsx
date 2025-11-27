"use client";

import { useState, useEffect } from "react";
import DownloadCounter from "./DownloadCounter";

interface UmamiStats {
  pageviews: { value: number };
  events: { value: number };
  eventData?: {
    'Download Video'?: { value: number };
    'Download Audio'?: { value: number };
  };
}

export default function StatsCounter() {
  const [stats, setStats] = useState<{ visits: number; videoDownloads: number; audioDownloads: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch pageviews from stats endpoint
        const statsResponse = await fetch(
          "https://cloud.umami.is/api/share/UAh3uDLWxgTu2Sva/stats",
          {
            headers: { Accept: "application/json" },
            cache: 'no-store', // Prevent caching
          }
        );

        let pageviews = 0;
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          console.log("[StatsCounter] Stats API response:", statsData);
          pageviews = statsData.pageviews?.value || statsData.pageviews || statsData.totals?.views || 0;
        }

        // Fetch events separately with date range (last 365 days to get all events)
        const now = Date.now();
        const startAt = 0; // Start from beginning
        const endAt = now;
        
        const eventsResponse = await fetch(
          `https://cloud.umami.is/api/share/UAh3uDLWxgTu2Sva/events?startAt=${startAt}&endAt=${endAt}`,
          {
            headers: { Accept: "application/json" },
            cache: 'no-store', // Prevent caching
          }
        );

        let videoDownloads = 0;
        let audioDownloads = 0;

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          console.log("[StatsCounter] Events API response:", eventsData);
          
          // Events can be in different formats
          if (Array.isArray(eventsData)) {
            // Find events by exact name match
            const videoEvent = eventsData.find((e: any) => 
              e.name === 'Download Video' || 
              e.event === 'Download Video' ||
              e.eventName === 'Download Video'
            );
            const audioEvent = eventsData.find((e: any) => 
              e.name === 'Download Audio' || 
              e.event === 'Download Audio' ||
              e.eventName === 'Download Audio'
            );
            
            videoDownloads = videoEvent?.value || videoEvent?.count || videoEvent?.total || videoEvent?.y || 0;
            audioDownloads = audioEvent?.value || audioEvent?.count || audioEvent?.total || audioEvent?.y || 0;
            
            console.log("[StatsCounter] Found events:", { videoEvent, audioEvent });
          } else if (eventsData.events && Array.isArray(eventsData.events)) {
            // Events nested in events array
            const videoEvent = eventsData.events.find((e: any) => 
              e.name === 'Download Video' || 
              e.event === 'Download Video' ||
              e.eventName === 'Download Video'
            );
            const audioEvent = eventsData.events.find((e: any) => 
              e.name === 'Download Audio' || 
              e.event === 'Download Audio' ||
              e.eventName === 'Download Audio'
            );
            
            videoDownloads = videoEvent?.value || videoEvent?.count || videoEvent?.total || videoEvent?.y || 0;
            audioDownloads = audioEvent?.value || audioEvent?.count || audioEvent?.total || audioEvent?.y || 0;
          } else if (typeof eventsData === 'object') {
            // Events as object with event names as keys
            videoDownloads = eventsData['Download Video']?.value || eventsData['Download Video']?.count || eventsData['Download Video'] || 0;
            audioDownloads = eventsData['Download Audio']?.value || eventsData['Download Audio']?.count || eventsData['Download Audio'] || 0;
          }
        } else {
          console.error("[StatsCounter] Events API response not OK:", eventsResponse.status, eventsResponse.statusText);
        }
        
        console.log("[StatsCounter] Final parsed stats:", { pageviews, videoDownloads, audioDownloads });
        
        setStats({
          visits: typeof pageviews === 'number' ? pageviews : 0,
          videoDownloads,
          audioDownloads,
        });
      } catch (error) {
        console.error("[StatsCounter] Failed to fetch stats:", error);
        // Set fallback values on error
        setStats({ visits: 0, videoDownloads: 0, audioDownloads: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M+`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K+`;
    }
    return `${num}+`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-4 text-sm text-[#fb923c]/80">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-[#fb923c]/40 border-t-[#fb923c] rounded-full animate-spin"></div>
          <span>Loading stats...</span>
        </div>
      </div>
    );
  }

  // Always show stats, even if 0, so users know the feature is working
  if (!stats) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-[#fb923c]/80">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="font-semibold">0+</span>
          <span className="text-[#fb923c]/60">visits</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="font-semibold">0+</span>
          <span className="text-[#fb923c]/60">downloads</span>
          <span className="text-[#fb923c]/40 text-xs">(no ads)</span>
        </div>
      </div>
    );
  }

  const totalDownloads = stats.videoDownloads + stats.audioDownloads;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-[#fb923c]/80">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span className="font-semibold">{formatNumber(stats.visits)}</span>
        <span className="text-[#fb923c]/60">visits</span>
      </div>
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="font-semibold"><DownloadCounter /></span>
        <span className="text-[#fb923c]/60">downloads</span>
        <span className="text-[#fb923c]/40 text-xs">(no ads)</span>
      </div>
    </div>
  );
}

