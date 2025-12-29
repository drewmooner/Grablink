"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface DownloadStats {
  total: number;
  today: number;
  video: number;
  audio: number;
  videoToday: number;
  audioToday: number;
}

type DateRange = 'today' | '7days' | '30days' | 'custom';

interface SiteStatus {
  live: boolean;
  lastChecked: number;
}

interface PauseState {
  paused: boolean;
  message?: string;
}

function AdminPanelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Get API base URL: use relative URLs (works on Vercel and localhost)
  const getApiBaseUrl = (): string => {
    // Always use relative URLs - works on Vercel serverless and localhost
    return "";
  };
  
  const [stats, setStats] = useState<DownloadStats>({
    total: 0,
    today: 0,
    video: 0,
    audio: 0,
    videoToday: 0,
    audioToday: 0,
  });
  const [siteStatus, setSiteStatus] = useState<SiteStatus>({ live: false, lastChecked: 0 });
  const [pauseState, setPauseState] = useState<PauseState>({ paused: false });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updateFlash, setUpdateFlash] = useState(false);
  const [previousStats, setPreviousStats] = useState<DownloadStats | null>(null);
  const [videoDateRange, setVideoDateRange] = useState<DateRange>('today');
  const [videoCustomStartDate, setVideoCustomStartDate] = useState<string>('');
  const [videoCustomEndDate, setVideoCustomEndDate] = useState<string>('');
  const [videoPeriodStats, setVideoPeriodStats] = useState(0);
  const [audioDateRange, setAudioDateRange] = useState<DateRange>('today');
  const [audioCustomStartDate, setAudioCustomStartDate] = useState<string>('');
  const [audioCustomEndDate, setAudioCustomEndDate] = useState<string>('');
  const [audioPeriodStats, setAudioPeriodStats] = useState(0);

  const loadVideoPeriodStats = useCallback(async () => {
    try {
      const now = Date.now();
      let startTime: number;
      let endTime: number = now;

      if (videoDateRange === 'today') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        startTime = todayStart.getTime();
      } else if (videoDateRange === '7days') {
        startTime = now - (7 * 24 * 60 * 60 * 1000);
      } else if (videoDateRange === '30days') {
        startTime = now - (30 * 24 * 60 * 60 * 1000);
      } else if (videoDateRange === 'custom' && videoCustomStartDate && videoCustomEndDate) {
        startTime = new Date(videoCustomStartDate).getTime();
        endTime = new Date(videoCustomEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
      } else {
        return;
      }

      const apiBase = getApiBaseUrl();
      const response = await fetch(
        `${apiBase}/api/admin/umami?type=all&startAt=${startTime}&endAt=${endTime}`,
        { cache: "no-store" }
      );

      if (response.ok) {
        try {
          const data = await response.json();
          const count = Number(data.videoDownloads) || 0;
          console.log("[Admin] Video period stats loaded:", count, "for range", videoDateRange);
          setVideoPeriodStats(count);
        } catch (parseError) {
          console.error("[Admin] Failed to parse video period stats:", parseError);
          setVideoPeriodStats(0);
        }
      } else {
        try {
          const errorText = await response.text().catch(() => "Unknown error");
          console.error("[Admin] Failed to load video period stats:", response.status, errorText.substring(0, 200));
        } catch (textError) {
          console.error("[Admin] Failed to load video period stats:", response.status);
        }
        setVideoPeriodStats(0);
      }
    } catch (error) {
      console.error("Failed to load video period stats:", error);
    }
  }, [videoDateRange, videoCustomStartDate, videoCustomEndDate]);

  const loadAudioPeriodStats = useCallback(async () => {
    try {
      const now = Date.now();
      let startTime: number;
      let endTime: number = now;

      if (audioDateRange === 'today') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        startTime = todayStart.getTime();
      } else if (audioDateRange === '7days') {
        startTime = now - (7 * 24 * 60 * 60 * 1000);
      } else if (audioDateRange === '30days') {
        startTime = now - (30 * 24 * 60 * 60 * 1000);
      } else if (audioDateRange === 'custom' && audioCustomStartDate && audioCustomEndDate) {
        startTime = new Date(audioCustomStartDate).getTime();
        endTime = new Date(audioCustomEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
      } else {
        return;
      }

      const apiBase = getApiBaseUrl();
      const response = await fetch(
        `${apiBase}/api/admin/umami?type=all&startAt=${startTime}&endAt=${endTime}`,
        { cache: "no-store" }
      );

      if (response.ok) {
        try {
          const data = await response.json();
          const count = Number(data.audioDownloads) || 0;
          console.log("[Admin] Audio period stats loaded:", count, "for range", audioDateRange);
          setAudioPeriodStats(count);
        } catch (parseError) {
          console.error("[Admin] Failed to parse audio period stats:", parseError);
          setAudioPeriodStats(0);
        }
      } else {
        try {
          const errorText = await response.text().catch(() => "Unknown error");
          console.error("[Admin] Failed to load audio period stats:", response.status, errorText.substring(0, 200));
        } catch (textError) {
          console.error("[Admin] Failed to load audio period stats:", response.status);
        }
        setAudioPeriodStats(0);
      }
    } catch (error) {
      console.error("Failed to load audio period stats:", error);
    }
  }, [audioDateRange, audioCustomStartDate, audioCustomEndDate]);

  const checkSiteStatus = useCallback(async () => {
    try {
      // Check if the site is live by checking the current domain
      const response = await fetch("/api/health", { 
        method: "GET",
        cache: "no-store"
      });
      if (response.ok) {
        setSiteStatus({ live: true, lastChecked: Date.now() });
      } else {
        setSiteStatus({ live: false, lastChecked: Date.now() });
      }
    } catch (error) {
      setSiteStatus({ live: false, lastChecked: Date.now() });
    }
  }, []);

  const loadPauseState = useCallback(async () => {
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/admin/pause`, { cache: "no-store" });
      if (response.ok) {
        try {
          const data = await response.json();
          setPauseState(data);
        } catch (parseError) {
          console.error("[Admin] Failed to parse pause state:", parseError);
          // Keep current state on parse error
        }
      } else {
        try {
          const errorText = await response.text().catch(() => "Unknown error");
          console.error("[Admin] Failed to load pause state:", response.status, errorText.substring(0, 200));
        } catch (textError) {
          console.error("[Admin] Failed to load pause state:", response.status);
        }
        // Keep current state on error
      }
    } catch (error) {
      console.error("[Admin] Failed to load pause state:", error);
      // Keep current state on network error
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartTime = todayStart.getTime();

      const apiBase = getApiBaseUrl();
      
      // Fetch all-time stats and events (fetch from beginning to get ALL past events)
      const allTimeStart = 0; // Start from beginning of time to get ALL events
      
      // Add timeout to prevent hanging - increased timeout for all-time request (may have many events)
      const controller1 = new AbortController();
      const timeout1 = setTimeout(() => controller1.abort(), 30000); // 30 second timeout for all-time request
      
      let allTimeResponse: Response | null = null;
      let todayResponse: Response | null = null;
      
      try {
        allTimeResponse = await fetch(
          `${apiBase}/api/admin/umami?type=all&startAt=${allTimeStart}&endAt=${now}`,
          {
            cache: "no-store",
            signal: controller1.signal,
          }
        );
        clearTimeout(timeout1);
      } catch (fetchError) {
        clearTimeout(timeout1);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.warn("[Admin] All-time request timeout - this is normal if you have many events. Stats will update on next refresh.");
        } else {
          console.error("[Admin] All-time fetch error:", fetchError);
        }
      }

      // Fetch today's stats and events
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 20000); // 20 second timeout for today's request
      
      try {
        todayResponse = await fetch(
          `${apiBase}/api/admin/umami?type=all&startAt=${todayStartTime}&endAt=${now}`,
          {
            cache: "no-store",
            signal: controller2.signal,
          }
        );
        clearTimeout(timeout2);
      } catch (fetchError) {
        clearTimeout(timeout2);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.warn("[Admin] Today request timeout - will retry on next refresh.");
        } else {
          console.error("[Admin] Today fetch error:", fetchError);
        }
      }

      let allTime = { video: 0, audio: 0, pageviews: 0 };
      let today = { video: 0, audio: 0, pageviews: 0 };

      if (allTimeResponse && allTimeResponse.ok) {
        try {
          const allTimeData = await allTimeResponse.json();
          console.log("[Admin] All-time API response:", {
            videoDownloads: allTimeData.videoDownloads,
            audioDownloads: allTimeData.audioDownloads,
            pageviews: allTimeData.pageviews,
            totalEvents: allTimeData.totalEvents,
            error: allTimeData.error
          });
          console.log("[Admin] API Base URL used:", apiBase || "relative");
          
          allTime = {
            video: Number(allTimeData.videoDownloads) || 0,
            audio: Number(allTimeData.audioDownloads) || 0,
            pageviews: Number(allTimeData.pageviews) || 0,
          };
          
          console.log("[Admin] All-time stats parsed:", allTime);
          console.log("[Admin] 📊 ALL-TIME SUMMARY (ALL PAST EVENTS):", {
            totalVideoDownloads: allTime.video,
            totalAudioDownloads: allTime.audio,
            totalDownloads: allTime.video + allTime.audio,
            totalPageviews: allTime.pageviews,
            totalEventsInUmami: allTimeData.totalEvents,
            eventsProcessed: allTimeData.eventsProcessed,
            dateRange: allTimeData.dateRange
          });
          
          if (allTimeData.error) {
            console.warn("[Admin] API returned error:", allTimeData.error);
          }
        } catch (parseError) {
          console.error("[Admin] Failed to parse all-time response:", parseError);
          allTime = { video: 0, audio: 0, pageviews: 0 };
        }
      } else if (allTimeResponse) {
        try {
          const errorText = await allTimeResponse.text().catch(() => "Unknown error");
          console.error("[Admin] All-time response not OK:", allTimeResponse.status, errorText.substring(0, 200));
        } catch (textError) {
          console.error("[Admin] All-time response not OK:", allTimeResponse.status);
        }
        allTime = { video: 0, audio: 0, pageviews: 0 };
      } else {
        console.error("[Admin] All-time response is null - request may have failed or timed out");
        allTime = { video: 0, audio: 0, pageviews: 0 };
      }

      if (todayResponse && todayResponse.ok) {
        try {
          const todayData = await todayResponse.json();
          console.log("[Admin] Today API response:", {
            videoDownloads: todayData.videoDownloads,
            audioDownloads: todayData.audioDownloads,
            pageviews: todayData.pageviews,
            totalEvents: todayData.totalEvents,
            error: todayData.error
          });
          
          today = {
            video: Number(todayData.videoDownloads) || 0,
            audio: Number(todayData.audioDownloads) || 0,
            pageviews: Number(todayData.pageviews) || 0,
          };
          
          console.log("[Admin] Today stats parsed:", today);
          
          if (todayData.error) {
            console.warn("[Admin] Today API returned error:", todayData.error);
          }
        } catch (parseError) {
          console.error("[Admin] Failed to parse today response:", parseError);
          today = { video: 0, audio: 0, pageviews: 0 };
        }
      } else if (todayResponse) {
        try {
          const errorText = await todayResponse.text().catch(() => "Unknown error");
          console.error("[Admin] Today response not OK:", todayResponse.status, errorText.substring(0, 200));
        } catch (textError) {
          console.error("[Admin] Today response not OK:", todayResponse.status);
        }
        today = { video: 0, audio: 0, pageviews: 0 };
      } else {
        console.error("[Admin] Today response is null - request may have failed or timed out");
        today = { video: 0, audio: 0, pageviews: 0 };
      }

      const total = allTime.video + allTime.audio;
      const todayTotal = today.video + today.audio;

      const newStats = {
        total,
        today: todayTotal,
        video: allTime.video,
        audio: allTime.audio,
        videoToday: today.video,
        audioToday: today.audio,
      };

      // Load period stats based on selected date ranges (don't wait if they fail)
      Promise.all([
        loadVideoPeriodStats().catch(err => console.error("[Admin] Video period stats failed:", err)),
        loadAudioPeriodStats().catch(err => console.error("[Admin] Audio period stats failed:", err))
      ]);

      // Check if stats changed (new downloads or views detected)
      if (previousStats) {
        const hasNewDownloads = 
          newStats.total > previousStats.total ||
          newStats.today > previousStats.today ||
          newStats.video > previousStats.video ||
          newStats.audio > previousStats.audio ||
          newStats.videoToday > previousStats.videoToday ||
          newStats.audioToday > previousStats.audioToday;
        
        if (hasNewDownloads) {
          // Flash animation to indicate update
          setUpdateFlash(true);
          setTimeout(() => setUpdateFlash(false), 1000);
          console.log("[Admin] ⚡ New activity detected!", {
            previous: previousStats,
            current: newStats,
            changes: {
              total: newStats.total - previousStats.total,
              today: newStats.today - previousStats.today,
              video: newStats.video - previousStats.video,
              audio: newStats.audio - previousStats.audio,
              videoToday: newStats.videoToday - previousStats.videoToday,
              audioToday: newStats.audioToday - previousStats.audioToday,
            }
          });
        }
      }

      // Update stats and previous stats
      // Always update stats even if API calls failed (use defaults)
      setStats(newStats);
      setPreviousStats(newStats);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load stats:", error);
      // Set default stats on error
      setStats({
        total: 0,
        today: 0,
        video: 0,
        audio: 0,
        videoToday: 0,
        audioToday: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [loadVideoPeriodStats, loadAudioPeriodStats, previousStats]);

  useEffect(() => {
    const password = searchParams.get("pw");
    if (password !== "kwiny191433") {
      router.push("/");
      return;
    }

    // Initial load with timeout fallback
    const initialLoad = async () => {
      try {
        await Promise.all([
          loadStats(),
          checkSiteStatus().catch(err => console.error("[Admin] Site status check failed:", err)),
          loadPauseState().catch(err => console.error("[Admin] Pause state load failed:", err)),
        ]);
      } catch (error) {
        console.error("[Admin] Initial load error:", error);
        setLoading(false); // Ensure loading is cleared even on error
      }
    };
    
    initialLoad();

    const interval = setInterval(() => {
      loadStats();
      checkSiteStatus().catch(err => console.error("[Admin] Site status check failed:", err));
      loadPauseState().catch(err => console.error("[Admin] Pause state load failed:", err));
      loadVideoPeriodStats().catch(err => console.error("[Admin] Video period stats failed:", err));
      loadAudioPeriodStats().catch(err => console.error("[Admin] Audio period stats failed:", err));
    }, 5000); // Refresh every 5 seconds for real-time updates

    // Fallback timeout to ensure loading state is cleared
    const fallbackTimeout = setTimeout(() => {
      console.warn("[Admin] Loading timeout - clearing loading state");
      setLoading(false);
    }, 10000); // 10 second fallback

    return () => {
      clearInterval(interval);
      clearTimeout(fallbackTimeout);
    };
  }, [searchParams, router, videoDateRange, videoCustomStartDate, videoCustomEndDate, audioDateRange, audioCustomStartDate, audioCustomEndDate, loadStats, checkSiteStatus, loadPauseState, loadVideoPeriodStats, loadAudioPeriodStats]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      if (action === "refresh") {
        console.log("[Admin] Refreshing stats...");
        await loadStats();
        await checkSiteStatus();
        await loadPauseState();
        console.log("[Admin] Refresh complete");
      } else if (action === "export") {
        console.log("[Admin] Exporting data...");
        const exportData = {
          stats,
          siteStatus,
          pauseState,
          exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `grablink-admin-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("[Admin] Export complete");
      } else if (action === "clear") {
        if (confirm("Clear browser cache and reload?")) {
          console.log("[Admin] Clearing cache...");
          localStorage.clear();
          window.location.reload();
        }
      } else if (action === "restart") {
        console.log("[Admin] Restarting service...");
        const apiBase = getApiBaseUrl();
        try {
          const response = await fetch(`${apiBase}/api/admin/restart`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          
          if (response.ok) {
            try {
              const data = await response.json();
              if (data.success) {
                console.log("[Admin] Restart initiated successfully");
                alert("Service restart initiated successfully!");
              } else {
                console.error("[Admin] Restart failed:", data.error);
                alert(`Restart failed: ${data.error || "Unknown error"}`);
              }
            } catch (parseError) {
              console.error("[Admin] Failed to parse restart response:", parseError);
              alert("Restart failed: Invalid response from server");
            }
          } else {
            try {
              const errorText = await response.text().catch(() => "Unknown error");
              console.error("[Admin] Restart failed:", response.status, errorText.substring(0, 200));
              alert(`Restart failed: ${response.status} ${errorText.substring(0, 100)}`);
            } catch (textError) {
              console.error("[Admin] Restart failed:", response.status);
              alert(`Restart failed: ${response.status}`);
            }
          }
        } catch (fetchError) {
          console.error("[Admin] Restart request failed:", fetchError);
          alert(`Restart failed: ${fetchError instanceof Error ? fetchError.message : "Network error"}`);
        }
      }
    } catch (error) {
      console.error(`[Admin] Action ${action} failed:`, error);
      alert(`Action failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-[#fb923c] text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#fb923c]">Grablink Admin</h1>
              <p className="text-gray-300 mt-1 sm:mt-2 text-sm sm:text-base">Admin Dashboard</p>
              {lastUpdated && (
                <p className="text-gray-400 mt-1 text-xs">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                  {updateFlash && <span className="ml-2 text-green-400 animate-pulse">● New activity detected!</span>}
                  <span className="ml-2 text-gray-500">(Auto-refresh: 5s)</span>
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${!pauseState.paused ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className="text-sm text-gray-300">
                  {pauseState.paused ? 'Down' : 'Live'}
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={async () => {
                    const newPausedState = !pauseState.paused;
                    // Update UI immediately for instant feedback
                    setPauseState({ paused: newPausedState, message: "We'll be back soon!" });
                    setActionLoading(newPausedState ? "pause" : "resume");
                    try {
                      const apiBase = getApiBaseUrl();
                      const response = await fetch(`${apiBase}/api/admin/pause`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                          paused: newPausedState, 
                          message: "We'll be back soon!" 
                        }),
                      });
                      
                      if (response.ok) {
                        try {
                          const data = await response.json();
                          if (data.success) {
                            // Confirm the state (already updated optimistically)
                            setPauseState({ paused: newPausedState, message: data.message });
                          } else {
                            // Revert on failure
                            setPauseState({ paused: !newPausedState, message: pauseState.message });
                            alert(`Toggle failed: ${data.error || "Unknown error"}`);
                          }
                        } catch (parseError) {
                          // Revert on parse error
                          setPauseState({ paused: !newPausedState, message: pauseState.message });
                          console.error("[Admin] Failed to parse pause toggle response:", parseError);
                          alert("Toggle failed: Invalid response from server");
                        }
                      } else {
                        // Revert on non-OK response
                        setPauseState({ paused: !newPausedState, message: pauseState.message });
                        try {
                          const errorText = await response.text().catch(() => "Unknown error");
                          console.error("[Admin] Pause toggle failed:", response.status, errorText.substring(0, 200));
                          alert(`Toggle failed: ${response.status} ${errorText.substring(0, 100)}`);
                        } catch (textError) {
                          console.error("[Admin] Pause toggle failed:", response.status);
                          alert(`Toggle failed: ${response.status}`);
                        }
                      }
                    } catch (error) {
                      // Revert on error
                      setPauseState({ paused: !newPausedState, message: pauseState.message });
                      console.error("[Admin] Toggle failed:", error);
                      alert(`Toggle failed: ${error instanceof Error ? error.message : "Unknown error"}`);
                    } finally {
                      setActionLoading(null);
                    }
                  }}
                  className={`relative inline-flex h-7 w-12 sm:h-6 sm:w-11 items-center rounded-full transition-colors ${
                    pauseState.paused ? 'bg-red-600' : 'bg-green-600'
                  } ${actionLoading === "pause" || actionLoading === "resume" ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform ${
                      pauseState.paused ? 'translate-x-1' : 'translate-x-6'
                    }`}
                  />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 transition-all duration-300 ${updateFlash ? 'scale-105' : 'scale-100'}`}>
          <div className={`bg-[#0a0a0a] border rounded-lg p-4 sm:p-6 hover:border-[#fb923c]/50 transition-all ${updateFlash && stats.total > (previousStats?.total || 0) ? 'border-green-500 shadow-lg shadow-green-500/50' : 'border-[#fb923c]/30'}`}>
            <div className="text-gray-300 text-xs sm:text-sm mb-2">Total Downloads</div>
            <div className="text-2xl sm:text-3xl font-bold text-[#fb923c]">{stats.total.toLocaleString()}</div>
            {previousStats && stats.total > previousStats.total && (
              <div className="text-green-400 text-xs mt-1 animate-pulse">+{stats.total - previousStats.total} new</div>
            )}
          </div>
          <div className={`bg-[#0a0a0a] border rounded-lg p-4 sm:p-6 hover:border-[#fb923c]/50 transition-all ${updateFlash && stats.today > (previousStats?.today || 0) ? 'border-green-500 shadow-lg shadow-green-500/50' : 'border-[#fb923c]/30'}`}>
            <div className="text-gray-300 text-xs sm:text-sm mb-2">Today</div>
            <div className="text-2xl sm:text-3xl font-bold text-[#fb923c]">{stats.today.toLocaleString()}</div>
            {previousStats && stats.today > previousStats.today && (
              <div className="text-green-400 text-xs mt-1 animate-pulse">+{stats.today - previousStats.today} new</div>
            )}
          </div>
        </div>

        {/* Video & Audio Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className={`bg-[#0a0a0a] border rounded-lg p-4 sm:p-6 transition-all ${updateFlash && stats.video > (previousStats?.video || 0) ? 'border-green-500 shadow-lg shadow-green-500/50' : 'border-[#fb923c]/30'}`}>
            <h3 className="text-lg sm:text-xl font-bold text-[#fb923c] mb-4">Video Downloads</h3>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs sm:text-sm">Total</div>
                <div className="text-xl sm:text-2xl font-bold text-[#fb923c]">{stats.video.toLocaleString()}</div>
                {previousStats && stats.video > previousStats.video && (
                  <div className="text-green-400 text-xs mt-1 animate-pulse">+{stats.video - previousStats.video} new</div>
                )}
              </div>
              <div>
                <div className="text-gray-400 text-xs sm:text-sm">Today</div>
                <div className="text-lg sm:text-xl font-bold text-[#fb923c]">{stats.videoToday.toLocaleString()}</div>
                {previousStats && stats.videoToday > previousStats.videoToday && (
                  <div className="text-green-400 text-xs mt-1 animate-pulse">+{stats.videoToday - previousStats.videoToday} new</div>
                )}
              </div>
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-1">
                  <div className="text-gray-400 text-xs sm:text-sm">Period</div>
                  <select
                    value={videoDateRange}
                    onChange={(e) => {
                      setVideoDateRange(e.target.value as DateRange);
                      if (e.target.value === 'custom') {
                        const today = new Date().toISOString().split('T')[0];
                        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        setVideoCustomStartDate(weekAgo);
                        setVideoCustomEndDate(today);
                      }
                    }}
                    className="bg-[#1a1a1a] border border-[#fb923c]/30 text-[#fb923c] text-xs sm:text-sm px-3 py-2 sm:px-2 sm:py-1 rounded focus:outline-none focus:border-[#fb923c] w-full sm:w-auto min-w-[140px]"
                  >
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
                {videoDateRange === 'custom' && (
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input
                      type="date"
                      value={videoCustomStartDate}
                      onChange={(e) => setVideoCustomStartDate(e.target.value)}
                      className="bg-[#1a1a1a] border border-[#fb923c]/30 text-[#fb923c] text-xs sm:text-sm px-3 py-2 sm:px-2 sm:py-1 rounded flex-1 focus:outline-none focus:border-[#fb923c]"
                    />
                    <input
                      type="date"
                      value={videoCustomEndDate}
                      onChange={(e) => setVideoCustomEndDate(e.target.value)}
                      className="bg-[#1a1a1a] border border-[#fb923c]/30 text-[#fb923c] text-xs sm:text-sm px-3 py-2 sm:px-2 sm:py-1 rounded flex-1 focus:outline-none focus:border-[#fb923c]"
                    />
                  </div>
                )}
                <div className="text-lg sm:text-xl font-semibold text-[#fb923c]/80">{videoPeriodStats.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div className={`bg-[#0a0a0a] border rounded-lg p-4 sm:p-6 transition-all ${updateFlash && stats.audio > (previousStats?.audio || 0) ? 'border-green-500 shadow-lg shadow-green-500/50' : 'border-[#fb923c]/30'}`}>
            <h3 className="text-lg sm:text-xl font-bold text-[#fb923c] mb-4">Audio Downloads</h3>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs sm:text-sm">Total</div>
                <div className="text-xl sm:text-2xl font-bold text-[#fb923c]">{stats.audio.toLocaleString()}</div>
                {previousStats && stats.audio > previousStats.audio && (
                  <div className="text-green-400 text-xs mt-1 animate-pulse">+{stats.audio - previousStats.audio} new</div>
                )}
              </div>
              <div>
                <div className="text-gray-400 text-xs sm:text-sm">Today</div>
                <div className="text-lg sm:text-xl font-bold text-[#fb923c]">{stats.audioToday.toLocaleString()}</div>
                {previousStats && stats.audioToday > previousStats.audioToday && (
                  <div className="text-green-400 text-xs mt-1 animate-pulse">+{stats.audioToday - previousStats.audioToday} new</div>
                )}
              </div>
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-1">
                  <div className="text-gray-400 text-xs sm:text-sm">Period</div>
                  <select
                    value={audioDateRange}
                    onChange={(e) => {
                      setAudioDateRange(e.target.value as DateRange);
                      if (e.target.value === 'custom') {
                        const today = new Date().toISOString().split('T')[0];
                        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        setAudioCustomStartDate(weekAgo);
                        setAudioCustomEndDate(today);
                      }
                    }}
                    className="bg-[#1a1a1a] border border-[#fb923c]/30 text-[#fb923c] text-xs sm:text-sm px-3 py-2 sm:px-2 sm:py-1 rounded focus:outline-none focus:border-[#fb923c] w-full sm:w-auto min-w-[140px]"
                  >
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
                {audioDateRange === 'custom' && (
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input
                      type="date"
                      value={audioCustomStartDate}
                      onChange={(e) => setAudioCustomStartDate(e.target.value)}
                      className="bg-[#1a1a1a] border border-[#fb923c]/30 text-[#fb923c] text-xs sm:text-sm px-3 py-2 sm:px-2 sm:py-1 rounded flex-1 focus:outline-none focus:border-[#fb923c]"
                    />
                    <input
                      type="date"
                      value={audioCustomEndDate}
                      onChange={(e) => setAudioCustomEndDate(e.target.value)}
                      className="bg-[#1a1a1a] border border-[#fb923c]/30 text-[#fb923c] text-xs sm:text-sm px-3 py-2 sm:px-2 sm:py-1 rounded flex-1 focus:outline-none focus:border-[#fb923c]"
                    />
                  </div>
                )}
                <div className="text-lg sm:text-xl font-semibold text-[#fb923c]/80">{audioPeriodStats.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Umami iframe */}
        <div className="bg-[#0a0a0a] border border-[#fb923c]/30 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-[#fb923c] mb-3 sm:mb-4">Analytics</h2>
          <div className="w-full h-[400px] sm:h-[500px] lg:h-[600px] border border-[#fb923c]/20 rounded overflow-hidden">
            <iframe
              src="https://cloud.umami.is/share/SgUhlS4KYP3zIBI7"
              className="w-full h-full border-0"
              title="Analytics"
            />
          </div>
        </div>



        {/* Action Buttons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <button
            onClick={() => handleAction("refresh")}
            disabled={actionLoading === "refresh"}
            className="bg-[#fb923c] hover:bg-[#f97316] text-black font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === "refresh" ? "Loading..." : "Refresh"}
          </button>
          <button
            onClick={() => handleAction("export")}
            disabled={actionLoading === "export"}
            className="bg-[#fb923c] hover:bg-[#f97316] text-black font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === "export" ? "Exporting..." : "Export"}
          </button>
          <button
            onClick={() => handleAction("clear")}
            disabled={actionLoading === "clear"}
            className="bg-[#fb923c] hover:bg-[#f97316] text-black font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === "clear" ? "Clearing..." : "Clear Cache"}
          </button>
          <button
            onClick={() => handleAction("restart")}
            disabled={actionLoading === "restart"}
            className="bg-[#fb923c] hover:bg-[#f97316] text-black font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === "restart" ? "Restarting..." : "Restart"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-[#fb923c] text-xl">Loading...</div>
      </div>
    }>
      <AdminPanelContent />
    </Suspense>
  );
}

