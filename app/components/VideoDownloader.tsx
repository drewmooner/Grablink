"use client";

import { useState, useEffect, useRef } from "react";
import type { VideoDownloadResponse, VideoInfoResponse, HistoryResponse, HistoryEntry } from "@/lib/types";
import Footer from "./Footer";

interface DownloadResult {
  success: boolean;
  downloadId?: string;
  downloadUrl?: string;
  filename?: string;
  fileSize?: number;
  error?: string;
}

export default function VideoDownloader() {
  const [url, setUrl] = useState("");
  const [audioOnly, setAudioOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfoResponse | null>(null);
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showNoHistoryMessage, setShowNoHistoryMessage] = useState(false);
  const [autoDownloadAttempted, setAutoDownloadAttempted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseMessage, setPauseMessage] = useState<string>("We'll be back soon!");
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get API base URL: use Render backend when on Vercel, relative URLs for localhost
  const getApiBaseUrl = (): string => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.");
      
      // Always use Render backend in production (not localhost)
      if (!isLocalhost) {
        // Hardcoded Render backend URL - always use this in production
        const RENDER_BACKEND_URL = "https://grablink.onrender.com";
        console.log("[VideoDownloader] 🌐 Production detected - Hostname:", hostname);
        console.log("[VideoDownloader] ✅ Using Render backend:", RENDER_BACKEND_URL);
        return RENDER_BACKEND_URL;
      } else {
        console.log("[VideoDownloader] 🏠 Localhost detected - using relative URLs");
        return ""; // Relative URL for localhost
      }
    }
    return ""; // Fallback for SSR
  };

  // Check pause state
  const checkPauseState = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/admin/pause`, { 
        cache: "no-store",
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setIsPaused(data.paused || false);
        setPauseMessage(data.message || "We'll be back soon!");
      }
    } catch (error) {
      // Silently handle network errors - don't log to console
      // This prevents console spam when API is unavailable
      // The app will continue to work normally if pause state check fails
    }
  };

  // Load history on mount and check pause state
  useEffect(() => {
    loadHistory();
    checkPauseState();
    const pauseInterval = setInterval(checkPauseState, 1000); // Check every 1 second for instant toggle updates
    return () => clearInterval(pauseInterval);
  }, []);

  // Clipboard paste detection
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return; // Don't interfere if user is typing
      }

      const pastedText = e.clipboardData?.getData("text");
      if (pastedText && isValidUrl(pastedText)) {
        setUrl(pastedText);
        setError(null);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  // Auto-scan URL when it changes
  useEffect(() => {
    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Reset video info when URL changes
    setVideoInfo(null);
    setError(null);
    setResult(null);

    // If URL is valid, scan it after a short delay (debounce)
    if (url.trim() && isValidUrl(url.trim())) {
      // Show spinner immediately when URL is detected
      setScanning(true);
      scanTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(`${getApiBaseUrl()}/api/video/info`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url.trim() }),
          });

          const data: VideoInfoResponse = await response.json();

          if (data.success) {
            setVideoInfo(data);
            setError(null);
          } else {
            // Show user-friendly error message with more details
            const errorCode = data.error?.code || "UNKNOWN_ERROR";
            const errorMessage = data.error?.message || "Failed to scan video";
            
            // Log full error for debugging
            console.error("[VideoDownloader] Video scan failed:", {
              code: errorCode,
              message: errorMessage,
              url: url.trim(),
              response: data
            });
            
            setError(`${errorMessage} (Error: ${errorCode})`);
            setVideoInfo(null);
          }
        } catch (err) {
          // Log network/parsing errors
          console.error("[VideoDownloader] Request failed:", err);
          const errorMessage = err instanceof Error ? err.message : "Failed to scan video";
          setError(`Network error: ${errorMessage}. Please check your connection and try again.`);
          setVideoInfo(null);
        } finally {
          setScanning(false);
        }
      }, 500); // Wait 500ms after user stops typing
    } else {
      setScanning(false);
    }

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [url]);

  const loadHistory = () => {
    try {
      // Load history from browser localStorage
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("grablink-history");
        if (stored) {
          const historyEntries: HistoryEntry[] = JSON.parse(stored);
          setHistory({
            success: true,
            history: historyEntries,
            total: historyEntries.length,
          });
        } else {
          setHistory({
            success: true,
            history: [],
            total: 0,
          });
        }
      }
    } catch (error) {
      console.error("Failed to load history:", error);
      setHistory({
        success: false,
        history: [],
        total: 0,
      });
    }
  };

  const saveHistoryToLocalStorage = (entries: HistoryEntry[]) => {
    try {
      if (typeof window !== "undefined") {
        // Keep only last 500 entries
        const limited = entries.slice(0, 500);
        localStorage.setItem("grablink-history", JSON.stringify(limited));
      }
    } catch (error) {
      console.error("Failed to save history to localStorage:", error);
    }
  };

  const handleDownload = async () => {
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    if (!isValidUrl(url)) {
      setError("Please enter a valid URL");
      return;
    }

    if (!videoInfo || !videoInfo.success) {
      setError("Please wait for video to be scanned first");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setAutoDownloadAttempted(false); // Reset when starting new download

    try {
      // Download (video info already scanned)
      const downloadResponse = await fetch(`${getApiBaseUrl()}/api/video/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          format: audioOnly ? "audio" : "video",
          audioFormat: "mp3",
        }),
      });

      const downloadData: VideoDownloadResponse = await downloadResponse.json();

      if (!downloadData.success) {
        throw new Error(downloadData.error?.message || "Download failed");
      }

      setResult({
        success: true,
        downloadId: downloadData.downloadId,
        downloadUrl: downloadData.download?.url,
        filename: downloadData.video?.filename,
        fileSize: downloadData.video?.size, // Use the actual file size from response
      });

      // Add to local history
      if (downloadData.metadata && downloadData.video) {
        const historyEntry: HistoryEntry = {
          id: downloadData.historyId || `hist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          url,
          platform: downloadData.platform,
          title: downloadData.metadata.title || "Untitled",
          author: downloadData.metadata.author || "Unknown",
          format: audioOnly ? "audio" : "video",
          quality: downloadData.video.quality || "original",
          downloadedAt: Date.now(),
          downloadId: downloadData.downloadId,
          fileSize: downloadData.video.size,
          duration: downloadData.video.duration,
        };
        
        const currentHistory = history?.history || [];
        const updatedHistory = [historyEntry, ...currentHistory].slice(0, 500);
        saveHistoryToLocalStorage(updatedHistory);
        setHistory({
          success: true,
          history: updatedHistory,
          total: updatedHistory.length,
        });
      }

      if (downloadData.download?.url) {
        // Always use full URL with Render backend in production
        const streamUrl = downloadData.download.url.startsWith('http')
          ? downloadData.download.url
          : `${getApiBaseUrl()}${downloadData.download.url}`;
        
        console.log("[VideoDownloader] Download URL:", streamUrl);
        
        // Mark that we attempted automatic download BEFORE triggering
        setAutoDownloadAttempted(true);
        setDownloadProgress(0);
        
        // Start download immediately - no delay
        triggerDownloadWithProgress(
          streamUrl,
          downloadData.video?.filename || "video",
          downloadData.video?.size || 0
        ).then(() => {
          // Clear result immediately after download completes to prevent "download again" button
          setResult(null);
        }).catch(() => {
          // On error, also clear result
          setResult(null);
        });
      } else {
        // No download URL - clear result immediately
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = (downloadUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
  };

  const triggerDownloadWithProgress = async (
    downloadUrl: string,
    filename: string,
    fileSize: number
  ): Promise<void> => {
    // Start progress bar immediately
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : fileSize || 0;
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const chunks: BlobPart[] = [];
      let receivedLength = 0;
      let lastProgressUpdate = 0;
      let lastUpdateTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Update progress smoothly - throttle updates to every ~100ms for smooth animation
        const now = Date.now();
        if (total > 0) {
          const currentProgress = Math.round((receivedLength / total) * 100);
          // Update if progress changed by at least 1% or if 100ms has passed
          if ((currentProgress !== lastProgressUpdate && currentProgress > lastProgressUpdate) || (now - lastUpdateTime) > 100) {
            setDownloadProgress(currentProgress);
            lastProgressUpdate = currentProgress;
            lastUpdateTime = now;
          }
        } else {
          // If we don't know the total size, show estimated progress
          const estimatedProgress = Math.min(95, Math.round((receivedLength / (fileSize || 1000000)) * 100));
          if ((estimatedProgress !== lastProgressUpdate && estimatedProgress > lastProgressUpdate) || (now - lastUpdateTime) > 100) {
            setDownloadProgress(estimatedProgress);
            lastProgressUpdate = estimatedProgress;
            lastUpdateTime = now;
          }
        }
      }

      // Combine chunks into a single blob
      const blob = new Blob(chunks);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setDownloadProgress(100);
      
      // Track Umami event
      try {
        if (typeof window !== "undefined") {
          const umami = (window as any).umami;
          const eventName = audioOnly ? "Download Audio" : "Download Video";
          
          if (umami) {
            // Umami can be a function or an object with track method
            if (typeof umami === "function") {
              umami(eventName);
              console.log("[VideoDownloader] Tracked Umami event:", eventName, "(function call)");
            } else if (umami.track && typeof umami.track === "function") {
              umami.track(eventName);
              console.log("[VideoDownloader] Tracked Umami event:", eventName, "(track method)");
            } else {
              console.warn("[VideoDownloader] Umami is not a function or trackable object", umami);
            }
          } else {
            console.warn("[VideoDownloader] Umami not available - window.umami is undefined");
            // Try to wait a bit and retry
            setTimeout(() => {
              const retryUmami = (window as any).umami;
              if (retryUmami) {
                if (typeof retryUmami === "function") {
                  retryUmami(eventName);
                  console.log("[VideoDownloader] Tracked Umami event (retry):", eventName);
                } else if (retryUmami.track) {
                  retryUmami.track(eventName);
                  console.log("[VideoDownloader] Tracked Umami event (retry):", eventName);
                }
              }
            }, 500);
          }
        }
      } catch (error) {
        console.error("Failed to track Umami event:", error);
      }
      
      // Clear result IMMEDIATELY after successful download to prevent "download again" button
      setResult(null);
      
      // Reset progress after a short delay (for visual feedback)
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
        // Keep autoDownloadAttempted true to prevent button from showing
        // Only reset when user starts a new download
      }, 300);
    } catch (error) {
      console.error("Download error:", error);
      setIsDownloading(false);
      setDownloadProgress(0);
      // Show user-friendly error message
      let errorMessage = "Download failed";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      // Check if it's a platform not supported error
      if (errorMessage.includes("not supported") || errorMessage.includes("TikTok")) {
        // Error message is already user-friendly from backend
      }
      setError(errorMessage);
      
      // Fallback to simple download
      triggerDownload(downloadUrl, filename);
      
      // Track Umami event for fallback download
      try {
        if (typeof window !== "undefined") {
          const umami = (window as any).umami;
          const eventName = audioOnly ? "Download Audio" : "Download Video";
          
          if (umami) {
            // Umami can be a function or an object with track method
            if (typeof umami === "function") {
              umami(eventName);
              console.log("[VideoDownloader] Tracked Umami event (fallback):", eventName, "(function call)");
            } else if (umami.track && typeof umami.track === "function") {
              umami.track(eventName);
              console.log("[VideoDownloader] Tracked Umami event (fallback):", eventName, "(track method)");
            }
          } else {
            // Retry after delay
            setTimeout(() => {
              const retryUmami = (window as any).umami;
              if (retryUmami) {
                if (typeof retryUmami === "function") {
                  retryUmami(eventName);
                  console.log("[VideoDownloader] Tracked Umami event (fallback retry):", eventName);
                } else if (retryUmami.track) {
                  retryUmami.track(eventName);
                  console.log("[VideoDownloader] Tracked Umami event (fallback retry):", eventName);
                }
              }
            }, 500);
          }
        }
      } catch (error) {
        console.error("Failed to track Umami event (fallback):", error);
      }
    }
  };

  const handleHistoryDownload = async (historyUrl: string) => {
    setUrl(historyUrl);
    setShowHistory(false);
    // Wait for auto-scan to complete, then download
    // The useEffect will handle scanning, and user can click download when ready
  };

  const deleteHistoryEntry = (id: string) => {
    try {
      const currentHistory = history?.history || [];
      const updatedHistory = currentHistory.filter(entry => entry.id !== id);
      saveHistoryToLocalStorage(updatedHistory);
      setHistory({
        success: true,
        history: updatedHistory,
        total: updatedHistory.length,
      });
    } catch (error) {
      console.error("Failed to delete history entry:", error);
    }
  };

  const clearHistory = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("grablink-history");
      }
      setHistory({
        success: true,
        history: [],
        total: 0,
      });
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const platformLower = platform.toLowerCase();
    const iconClass = "w-5 h-5 sm:w-6 sm:h-6 text-[#fb923c]";
    
    if (platformLower === "instagram") {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      );
    } else if (platformLower === "youtube") {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    } else if (platformLower === "twitter") {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    } else if (platformLower === "facebook") {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    } else if (platformLower === "pinterest") {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.403.041-3.441.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12 24c6.624 0 12-5.373 12-12S18.624.001 12 .001z"/>
        </svg>
      );
    } else if (platformLower === "vimeo") {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.011 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/>
        </svg>
      );
    } else if (platformLower === "twitch") {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
        </svg>
      );
    } else if (platformLower === "reddit") {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
        </svg>
      );
    } else {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
        </svg>
      );
    }
  };

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return "";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      const kb = bytes / 1024;
      return `(${kb.toFixed(1)} KB)`;
    } else if (mb < 1024) {
      return `(${mb.toFixed(1)} MB)`;
    } else {
      const gb = mb / 1024;
      return `(${gb.toFixed(2)} GB)`;
    }
  };

  // Get audio file size (always returns audio size, regardless of selection)
  const getAudioSize = (): number | null => {
    if (!videoInfo?.success) return null;
    
    // Check if audioOnly exists and has a valid size
    if (videoInfo.audioOnly) {
      const audioSize = videoInfo.audioOnly.size;
      if (audioSize && audioSize > 0) {
        return audioSize;
      }
    }
    
    // Fallback: estimate audio size as ~10% of video size if available
    if (videoInfo.qualities && videoInfo.qualities.length > 0) {
      const videoSize = videoInfo.qualities[0].size;
      if (videoSize && videoSize > 0) {
        return Math.round(videoSize * 0.1); // Rough estimate: audio is ~10% of video size
      }
    }
    
    return null;
  };

  // Get estimated file size from video info based on format (for download button)
  const getEstimatedSize = (): number | null => {
    if (!videoInfo?.success) return null;
    
    // If audio is selected, return audio-only size (should be smaller)
    if (audioOnly) {
      return getAudioSize();
    }
    
    // For video, return the best quality video size (should be larger than audio)
    if (videoInfo.qualities && videoInfo.qualities.length > 0) {
      // Get the best quality (first one, as they're sorted by quality descending)
      const bestQuality = videoInfo.qualities[0];
      if (bestQuality && bestQuality.size && bestQuality.size > 0) {
        return bestQuality.size;
      }
    }
    
    return null;
  };

  // Show maintenance message if paused
  if (isPaused) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center relative">
        <div className="text-center px-4 z-50">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black mb-4 festive-glow" style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #16a34a 50%, #eab308 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', 
            textShadow: '0 0 20px rgba(251, 146, 60, 0.5), 0 0 40px rgba(251, 146, 60, 0.3)'
          }}>
            Grablink
          </h1>
          <div className="bg-[#0a0a0a] border border-[#fb923c]/30 rounded-lg p-8 max-w-md mx-auto">
            <div className="text-4xl mb-4">🔧</div>
            <h2 className="text-2xl font-bold text-[#fb923c] mb-4">Under Maintenance</h2>
            <p className="text-gray-300 text-lg">{pauseMessage}</p>
            <div className="mt-6 text-gray-400 text-sm">
              We're working hard to improve your experience. Check back soon!
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] animated-background relative">
      {/* 🎄 Christmas & New Year Festive Effects 🎉 */}
      {[...Array(20)].map((_, i) => (
        <div
          key={`snowflake-${i}`}
          className="snowflake"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${5 + Math.random() * 5}s`,
          }}
        >
          ❄
        </div>
      ))}
      {[...Array(15)].map((_, i) => (
        <div
          key={`sparkle-${i}`}
          className="sparkle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${1.5 + Math.random() * 1}s`,
          }}
        />
      ))}
      
      {/* Floating Orbs */}
      <div className="floating-orb floating-orb-1"></div>
      <div className="floating-orb floating-orb-2"></div>
      <div className="floating-orb floating-orb-3"></div>
      
      {/* Professional Mesh Pattern Overlay */}
      <div className="mesh-overlay"></div>
      
      {/* Animated Black Stripes - Professional Grid Pattern */}
      {/* Horizontal */}
      <div className="stripe stripe-1"></div>
      <div className="stripe stripe-2"></div>
      <div className="stripe stripe-3"></div>
      <div className="stripe stripe-4"></div>
      <div className="stripe stripe-5"></div>
      <div className="stripe stripe-6"></div>
      <div className="stripe stripe-7"></div>
      <div className="stripe stripe-8"></div>
      <div className="stripe stripe-9"></div>
      <div className="stripe stripe-10"></div>
      {/* Vertical */}
      <div className="stripe stripe-11"></div>
      <div className="stripe stripe-12"></div>
      <div className="stripe stripe-13"></div>
      <div className="stripe stripe-14"></div>
      <div className="stripe stripe-15"></div>
      <div className="stripe stripe-16"></div>
      {/* Diagonal 45° */}
      <div className="stripe stripe-17"></div>
      <div className="stripe stripe-18"></div>
      <div className="stripe stripe-19"></div>
      <div className="stripe stripe-20"></div>
      <div className="stripe stripe-21"></div>
      {/* Diagonal 30° */}
      <div className="stripe stripe-22"></div>
      <div className="stripe stripe-23"></div>
      <div className="stripe stripe-24"></div>
      <div className="stripe stripe-25"></div>
      
      {/* Animated White Stripes - Professional Grid Pattern */}
      {/* Horizontal White */}
      <div className="stripe-white stripe-white-1"></div>
      <div className="stripe-white stripe-white-2"></div>
      <div className="stripe-white stripe-white-3"></div>
      <div className="stripe-white stripe-white-4"></div>
      <div className="stripe-white stripe-white-5"></div>
      <div className="stripe-white stripe-white-6"></div>
      <div className="stripe-white stripe-white-7"></div>
      <div className="stripe-white stripe-white-8"></div>
      <div className="stripe-white stripe-white-9"></div>
      <div className="stripe-white stripe-white-10"></div>
      {/* Vertical White */}
      <div className="stripe-white stripe-white-11"></div>
      <div className="stripe-white stripe-white-12"></div>
      <div className="stripe-white stripe-white-13"></div>
      <div className="stripe-white stripe-white-14"></div>
      <div className="stripe-white stripe-white-15"></div>
      <div className="stripe-white stripe-white-16"></div>
      {/* Diagonal 45° White */}
      <div className="stripe-white stripe-white-17"></div>
      <div className="stripe-white stripe-white-18"></div>
      <div className="stripe-white stripe-white-19"></div>
      <div className="stripe-white stripe-white-20"></div>
      <div className="stripe-white stripe-white-21"></div>
      {/* Diagonal 30° White */}
      <div className="stripe-white stripe-white-22"></div>
      <div className="stripe-white stripe-white-23"></div>
      <div className="stripe-white stripe-white-24"></div>
      <div className="stripe-white stripe-white-25"></div>
      
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-4xl relative z-10">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 animate-fadeIn relative">
          {/* Christmas Hat */}
          <div className="flex justify-center mb-2 animate-fadeIn" style={{ animationDelay: '0s' }}>
            <svg 
              width="80" 
              height="60" 
              viewBox="0 0 100 80" 
              className="drop-shadow-lg"
              style={{ filter: 'drop-shadow(0 4px 8px rgba(220, 38, 38, 0.4))' }}
            >
              {/* Hat Base (Red) */}
              <path 
                d="M20 50 Q50 20 80 50 L75 70 L25 70 Z" 
                fill="#dc2626" 
                stroke="#b91c1c" 
                strokeWidth="1"
              />
              {/* White Fur Trim */}
              <path 
                d="M25 70 Q50 60 75 70" 
                fill="#ffffff" 
                stroke="#e5e5e5" 
                strokeWidth="0.5"
              />
              {/* Pom Pom (White) */}
              <circle 
                cx="20" 
                cy="50" 
                r="8" 
                fill="#ffffff" 
                stroke="#e5e5e5" 
                strokeWidth="0.5"
              />
              {/* Pom Pom Highlight */}
              <circle 
                cx="18" 
                cy="48" 
                r="3" 
                fill="#f0f0f0"
              />
            </svg>
          </div>
          <h1 className="text-5xl xs:text-6xl sm:text-7xl md:text-8xl font-black mb-2 sm:mb-3 text-[#fb923c] animate-slideIn relative z-20" style={{ 
            textShadow: '0 0 20px rgba(251, 146, 60, 0.5), 0 0 40px rgba(251, 146, 60, 0.3), 0 4px 15px rgba(0, 0, 0, 0.4)',
            filter: 'drop-shadow(0 0 10px rgba(251, 146, 60, 0.4))'
          }}>
            Grablink
          </h1>
          <p className="text-sm xs:text-base sm:text-lg text-white/80 font-medium tracking-tight animate-fadeIn px-2" style={{ animationDelay: '0.1s' }}>
            Save access; always on
          </p>
        </div>

        {/* Main Download Card */}
        <div className="bg-[#1a1a1a]/90 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 mb-3 sm:mb-4 md:mb-6 border border-[#1a1a1a] hover:border-[#fb923c] hover:shadow-[0_0_10px_rgba(251,146,60,0.3)] transition-all duration-300 animate-fadeIn relative group" style={{ animationDelay: '0.2s' }}>
          {/* Amber Orange Glow on Hover - Left Side */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#fb923c] opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:shadow-[0_0_8px_rgba(251,146,60,0.4)] rounded-l-xl"></div>
          {/* Amber Orange Glow on Hover - Right Side */}
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#fb923c] opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:shadow-[0_0_8px_rgba(251,146,60,0.4)] rounded-r-xl"></div>
          {/* URL Input */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm sm:text-base font-medium text-[#fb923c] mb-2">
              Video URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative min-w-0">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !loading && videoInfo?.success && handleDownload()}
                    placeholder="Paste video URL here..."
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-14 sm:pr-14 text-sm sm:text-base border-2 border-[#fb923c]/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fb923c] focus:border-[#fb923c] bg-[#1a1a1a] text-[#fb923c] transition-all duration-200 hover:border-[#fb923c]/60 truncate"
                    disabled={loading}
                    style={{ textOverflow: 'ellipsis' }}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    {scanning && (
                      <div className="spinner-circle" title="Scanning video..."></div>
                    )}
                    {videoInfo?.success && !scanning && !loading && (
                      <svg className="w-5 h-5 text-[#fb923c] animate-fadeIn" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                {url && !loading && !scanning && (
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => {
                        setUrl("");
                        setVideoInfo(null);
                        setError(null);
                        setResult(null);
                      }}
                      className="text-[#fb923c] hover:text-white hover:bg-[#fb923c] transition-all duration-200 text-xl sm:text-lg font-bold w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-[#fb923c]/20 border-2 border-[#fb923c]/50 hover:border-[#fb923c] shadow-sm hover:shadow-md"
                      title="Clear URL"
                      aria-label="Clear URL"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (!history || history.history.length === 0) {
                    setShowNoHistoryMessage(true);
                    setTimeout(() => setShowNoHistoryMessage(false), 3000);
                  } else {
                    setShowHistory(!showHistory);
                  }
                }}
                className="px-3 sm:px-4 py-2.5 sm:py-3 bg-[#1a1a1a] text-[#fb923c] rounded-lg hover:bg-[#fb923c]/10 transition-all duration-200 hover:scale-105 transform text-base sm:text-lg border border-[#fb923c]/30"
                title="View History"
              >
                📜
              </button>
            </div>
            <p className="text-xs text-[#fb923c]/70 mt-1 hidden xs:block">
              Paste URL anywhere on the page to auto-fill • Auto-scans when valid URL detected
              <span className="ml-2 festive-glow">🎄✨🎉</span>
            </p>
          </div>

          {/* Video Info Preview */}
          {videoInfo?.success && videoInfo.metadata && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-[#fb923c]/20 to-[#1a1a1a] rounded-lg sm:rounded-xl border-2 border-[#fb923c]/40">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {videoInfo.metadata.thumbnail && (
                  <img
                    src={videoInfo.metadata.thumbnail}
                    alt={videoInfo.metadata.title}
                    className="w-full sm:w-24 md:w-28 h-32 sm:h-24 md:h-28 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl sm:text-2xl">{getPlatformIcon(videoInfo.platform)}</span>
                    <span className="text-xs px-2 py-1 bg-gradient-to-r from-[#fb923c] to-[#1a1a1a] text-white rounded font-semibold shadow-md">
                      {videoInfo.platform.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[#fb923c] truncate text-sm sm:text-base mb-1">
                    {videoInfo.metadata.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#fb923c]/80 truncate">
                    {videoInfo.metadata.author?.displayName || videoInfo.metadata.author?.username}
                  </p>
                  {videoInfo.metadata.duration && (
                    <p className="text-xs text-[#fb923c]/70 mt-1">
                      Duration: {Math.floor(videoInfo.metadata.duration / 60)}:{(videoInfo.metadata.duration % 60).toString().padStart(2, "0")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Audio Only Toggle */}
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 p-3 sm:p-4 bg-gradient-to-r from-[#fb923c]/20 to-[#1a1a1a] rounded-lg sm:rounded-xl border-2 border-[#fb923c]/40 text-sm sm:text-base">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="audioOnly"
                checked={audioOnly}
                onChange={(e) => setAudioOnly(e.target.checked)}
                className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <label htmlFor="audioOnly" className="text-sm sm:text-base font-medium text-[#fb923c]">
                Download audio only (MP3)
              </label>
            </div>
            {videoInfo?.success && (() => {
              const audioSize = getAudioSize();
              if (audioSize && audioSize > 0) {
                return (
                  <span className="text-sm text-[#fb923c]/80 font-medium">
                    {formatFileSize(audioSize)}
                    <span className="opacity-75 text-xs ml-1">(est.)</span>
                  </span>
                );
              }
              if (videoInfo.qualities && videoInfo.qualities.length > 0) {
                const videoSize = videoInfo.qualities[0]?.size;
                if (videoSize && videoSize > 0) {
                  const estimatedAudio = Math.round(videoSize * 0.1);
                  return (
                    <span className="text-sm text-[#fb923c]/80 font-medium opacity-75">
                      {formatFileSize(estimatedAudio)}
                      <span className="text-xs ml-1">(est.)</span>
                    </span>
                  );
                }
              }
              return null;
            })()}
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={loading || !url.trim() || !videoInfo?.success || scanning}
            className="w-full py-3 sm:py-3.5 md:py-4 text-sm sm:text-base gradient-bg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none disabled:hover:scale-100"
          >
            {loading ? (
              <>
                <div className="spinner-circle-small"></div>
                Downloading...
              </>
            ) : scanning ? (
              <>
                <div className="spinner-circle-small"></div>
                Scanning video...
              </>
            ) : !videoInfo?.success ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Waiting for video scan...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download {audioOnly ? "Audio" : "Video"}
                {(() => {
                  const estimatedSize = getEstimatedSize();
                  if (estimatedSize && estimatedSize > 0) {
                    return (
                      <span className="text-sm font-normal opacity-75">
                        {formatFileSize(estimatedSize)}
                        <span className="text-xs ml-1">(est.)</span>
                      </span>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-[#fb923c]/20 to-[#1a1a1a] border-2 border-[#fb923c]/40 rounded-lg sm:rounded-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-[#fb923c] text-xs sm:text-sm md:text-base font-semibold flex-1 break-words flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {error}
                </p>
                {url.trim() && isValidUrl(url.trim()) && (
                  <button
                    onClick={async () => {
                      setError(null);
                      setVideoInfo(null);
                      setScanning(true);
                      try {
                        const response = await fetch(`${getApiBaseUrl()}/api/video/info`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ url: url.trim() }),
                        });
                        const data: VideoInfoResponse = await response.json();
                        if (data.success) {
                          setVideoInfo(data);
                          setError(null);
                        } else {
                          const errorMessage = data.error?.message || "Failed to scan video";
                          setError(errorMessage);
                          setVideoInfo(null);
                        }
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to scan video");
                        setVideoInfo(null);
                      } finally {
                        setScanning(false);
                      }
                    }}
                    disabled={scanning}
                    className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#fb923c] to-[#1a1a1a] hover:from-[#fb923c]/90 hover:to-[#1a1a1a]/90 rounded-lg transition-all duration-200 hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-sm hover:shadow-md border border-[#fb923c]/50 whitespace-nowrap flex items-center gap-2"
                  >
                    {scanning ? (
                      <>
                        <div className="spinner-circle-small"></div>
                        <span>Retrying...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Retry</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Success Result */}
          {result?.success && (
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-[#fb923c]/20 to-[#1a1a1a] border-2 border-[#fb923c]/40 rounded-lg sm:rounded-xl">
              <p className="text-[#fb923c] text-sm sm:text-base mb-3 font-semibold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Download ready!
                {result.fileSize && result.fileSize > 0 && (
                  <span className="ml-2 text-sm sm:text-base font-semibold">
                    Actual size: {formatFileSize(result.fileSize)}
                  </span>
                )}
              </p>
              
              {/* Download Progress Bar */}
              {isDownloading && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-[#fb923c]/80 mb-1">
                    <span>Downloading...</span>
                    <span>{downloadProgress}%</span>
                  </div>
                  <div className="w-full bg-[#1a1a1a] rounded-full h-2.5 overflow-hidden border border-[#fb923c]/30">
                    <div
                      className="gradient-bg h-2.5 rounded-full transition-all duration-300 ease-out shadow-sm"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              
              {result?.downloadUrl && !isDownloading && !autoDownloadAttempted && downloadProgress === 0 && result?.success && (
                <button
                  onClick={() => {
                    setAutoDownloadAttempted(true);
                    setIsDownloading(true);
                    setDownloadProgress(0);
                    if (result.fileSize) {
                      triggerDownloadWithProgress(
                        result.downloadUrl!,
                        result.filename || "video",
                        result.fileSize
                      );
                    } else {
                      triggerDownload(result.downloadUrl!, result.filename || "video");
                      setIsDownloading(false);
                      // Track Umami event for simple download
                      try {
                        if (typeof window !== "undefined") {
                          const umami = (window as any).umami;
                          if (umami) {
                            const eventName = audioOnly ? "Download Audio" : "Download Video";
                            // Umami can be a function or an object with track method
                            if (typeof umami === "function") {
                              umami(eventName);
                            } else if (umami.track && typeof umami.track === "function") {
                              umami.track(eventName);
                            } else {
                              console.warn("[VideoDownloader] Umami is not a function or trackable object");
                            }
                            console.log("[VideoDownloader] Tracked Umami event (simple download):", eventName);
                          } else {
                            console.warn("[VideoDownloader] Umami not available for simple download");
                          }
                        }
                      } catch (error) {
                        console.error("Failed to track Umami event:", error);
                      }
                    }
                  }}
                  className="text-sm text-[#fb923c] hover:text-[#fb923c]/80 hover:underline font-medium transition-all duration-200 hover:scale-105 transform"
                >
                  Click here if download didn&apos;t start automatically
                </button>
              )}
            </div>
          )}
        </div>

        {/* History Panel */}
        {showHistory && history && history.history.length > 0 && (
          <div className="bg-[#1a1a1a]/90 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 border-2 border-[#fb923c]/30">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#fb923c]">
                Download History
              </h2>
              <button
                onClick={clearHistory}
                className="text-xs sm:text-sm text-[#fb923c]/80 hover:text-[#fb923c] hover:underline font-medium"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-2 max-h-64 sm:max-h-80 md:max-h-96 overflow-y-auto scrollbar-thin">
              {history.history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-2 sm:p-3 bg-gradient-to-r from-[#fb923c]/20 to-[#1a1a1a] rounded-lg sm:rounded-xl hover:from-[#fb923c]/30 hover:to-[#1a1a1a] transition-colors duration-200 hover:shadow-md border border-[#fb923c]/40"
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <span className="flex-shrink-0">{getPlatformIcon(entry.platform)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm md:text-base font-medium text-[#fb923c] truncate">
                        {entry.title}
                      </p>
                      <p className="text-xs sm:text-sm text-[#fb923c]/80 truncate">
                        <span className="hidden sm:inline">{entry.author} • </span>
                        {new Date(entry.downloadedAt).toLocaleDateString()}
                        {entry.fileSize && entry.fileSize > 0 && (
                          <span className="ml-1 sm:ml-2">• {formatFileSize(entry.fileSize)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:ml-4 self-end sm:self-auto">
                    <button
                      onClick={() => handleHistoryDownload(entry.url)}
                      className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm gradient-bg hover:opacity-90 text-white rounded-lg sm:rounded transition-all duration-200 hover:scale-110 transform shadow-sm font-medium flex items-center justify-center"
                      title="Re-download"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteHistoryEntry(entry.id)}
                      className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm bg-[#1a1a1a] hover:bg-[#fb923c]/20 text-[#fb923c] rounded-lg sm:rounded transition-all duration-200 hover:scale-110 transform shadow-sm font-medium border border-[#fb923c]/30 flex items-center justify-center"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No History Message Popup */}
        {showNoHistoryMessage && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-fadeIn">
            <div className="bg-gradient-to-r from-[#fb923c]/90 to-[#1a1a1a]/90 backdrop-blur-md px-6 py-4 rounded-xl shadow-2xl border-2 border-[#fb923c]/50 animate-fadeIn">
              <p className="text-[#fb923c] font-semibold text-base sm:text-lg text-center">
                No history yet
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}

