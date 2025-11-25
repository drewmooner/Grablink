"use client";

import { useState, useEffect, useRef } from "react";
import type { VideoDownloadResponse, VideoInfoResponse, HistoryResponse } from "@/lib/types";
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
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
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
      // Check for TikTok URLs early and show friendly message
      const urlLower = url.trim().toLowerCase();
      if (urlLower.includes("tiktok.com") || urlLower.includes("vm.tiktok.com") || urlLower.includes("vt.tiktok.com")) {
        setError("TikTok is currently not supported. We're working on adding support for other platforms. Please try Instagram, YouTube, Twitter, or other supported platforms.");
        setVideoInfo(null);
        setScanning(false);
        return;
      }

      // Show spinner immediately when URL is detected
      setScanning(true);
      scanTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch("https://resplendent-passion-production.up.railway.app/api/video/info", {
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

  const loadHistory = async () => {
    try {
      const response = await fetch("/api/video/history");
      const data: HistoryResponse = await response.json();
      if (data.success) {
        setHistory(data);
      }
    } catch (error) {
      console.error("Failed to load history:", error);
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

    try {
      // Download (video info already scanned)
      const downloadResponse = await fetch("https://resplendent-passion-production.up.railway.app/api/video/download", {
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

      // Reload history
      loadHistory();

      // Auto-download immediately if URL is available with progress tracking
      if (downloadData.download?.url) {
        // Start download immediately - no delay
        triggerDownloadWithProgress(
          downloadData.download.url,
          downloadData.video?.filename || "video",
          downloadData.video?.size || 0
        );
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
  ) => {
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
      
      // Reset progress after a short delay
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 1000);
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
    }
  };

  const handleHistoryDownload = async (historyUrl: string) => {
    setUrl(historyUrl);
    setShowHistory(false);
    // Wait for auto-scan to complete, then download
    // The useEffect will handle scanning, and user can click download when ready
  };

  const deleteHistoryEntry = async (id: string) => {
    try {
      await fetch(`/api/video/history?id=${id}`, { method: "DELETE" });
      loadHistory();
    } catch (error) {
      console.error("Failed to delete history entry:", error);
    }
  };

  const clearHistory = async () => {
    try {
      await fetch("/api/video/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      loadHistory();
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      instagram: "📷",
      youtube: "▶️",
      twitter: "🐦",
      facebook: "👥",
      pinterest: "📌",
      vimeo: "🎬",
      twitch: "🎮",
      reddit: "🤖",
    };
    return icons[platform.toLowerCase()] || "🔗";
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

  return (
    <div className="min-h-screen bg-[#1a1a1a] animated-background relative">
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
        <div className="bg-[#1a1a1a]/90 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 mb-3 sm:mb-4 md:mb-6 border border-[#1a1a1a] hover:border-[#fb923c] hover:shadow-[0_0_20px_rgba(251,146,60,0.5),0_0_40px_rgba(251,146,60,0.3)] hover:shadow-[#fb923c] transition-all duration-300 animate-fadeIn relative group" style={{ animationDelay: '0.2s' }}>
          {/* Amber Orange Glow on Hover - Left Side */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#fb923c] opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:shadow-[0_0_20px_rgba(251,146,60,0.8)] rounded-l-xl"></div>
          {/* Amber Orange Glow on Hover - Right Side */}
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#fb923c] opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:shadow-[0_0_20px_rgba(251,146,60,0.8)] rounded-r-xl"></div>
          {/* URL Input */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm sm:text-base font-medium text-[#fb923c] mb-2">
              Video URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && videoInfo?.success && handleDownload()}
                  placeholder="Paste video URL here..."
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-[#fb923c]/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fb923c] focus:border-[#fb923c] bg-[#1a1a1a] text-[#fb923c] transition-all duration-200 hover:border-[#fb923c]/60"
                  disabled={loading}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {scanning && (
                    <div className="spinner-circle" title="Scanning video..."></div>
                  )}
                  {videoInfo?.success && !scanning && !loading && (
                    <span className="animate-fadeIn" style={{ color: '#fb923c', fontSize: '18px' }}>✅</span>
                  )}
                  {url && !loading && !scanning && (
                    <button
                      onClick={() => {
                        setUrl("");
                        setVideoInfo(null);
                        setError(null);
                        setResult(null);
                      }}
                      className="text-[#fb923c]/60 hover:text-[#fb923c] transition-colors text-lg font-bold"
                      title="Clear all"
                    >
                      ✕
                    </button>
                  )}
                </div>
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
                <span>⏸️</span>
                Waiting for video scan...
              </>
            ) : (
              <>
                <span>⬇️</span>
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
                <p className="text-[#fb923c] text-xs sm:text-sm md:text-base font-semibold flex-1 break-words">❌ {error}</p>
                {url.trim() && isValidUrl(url.trim()) && (
                  <button
                    onClick={async () => {
                      setError(null);
                      setVideoInfo(null);
                      setScanning(true);
                      try {
                        const response = await fetch("https://resplendent-passion-production.up.railway.app/api/video/info", {
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
                        <span>🔄</span>
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
              <p className="text-[#fb923c] text-sm sm:text-base mb-3 font-semibold">
                <span style={{ color: '#fb923c', fontSize: '18px' }}>✅</span> Download ready!
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
              
              {result.downloadUrl && !isDownloading && (
                <button
                  onClick={() => {
                    if (result.fileSize) {
                      triggerDownloadWithProgress(
                        result.downloadUrl!,
                        result.filename || "video",
                        result.fileSize
                      );
                    } else {
                      triggerDownload(result.downloadUrl!, result.filename || "video");
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
                    <span className="text-lg sm:text-xl md:text-2xl flex-shrink-0">{getPlatformIcon(entry.platform)}</span>
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
                      className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm gradient-bg hover:opacity-90 text-white rounded-lg sm:rounded transition-all duration-200 hover:scale-110 transform shadow-sm font-medium"
                      title="Re-download"
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={() => deleteHistoryEntry(entry.id)}
                      className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm bg-[#1a1a1a] hover:bg-[#fb923c]/20 text-[#fb923c] rounded-lg sm:rounded transition-all duration-200 hover:scale-110 transform shadow-sm font-medium border border-[#fb923c]/30"
                      title="Delete"
                    >
                      🗑️
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

