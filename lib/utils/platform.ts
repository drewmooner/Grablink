// Platform detection utility

import type { Platform } from "@/lib/types";

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): Platform {
  const urlLower = url.toLowerCase().trim();

  // TikTok detection - check for all TikTok URL patterns
  if (
    urlLower.includes("tiktok.com") || 
    urlLower.includes("vm.tiktok.com") || 
    urlLower.includes("vt.tiktok.com") ||
    urlLower.includes("tiktok.com/") ||
    urlLower.startsWith("tiktok://")
  ) {
    console.log("[detectPlatform] TikTok detected:", url);
    return "tiktok";
  }

  if (urlLower.includes("instagram.com") || urlLower.includes("instagr.am")) {
    return "instagram";
  }
  if (
    urlLower.includes("youtube.com") ||
    urlLower.includes("youtu.be") ||
    urlLower.includes("youtube.com/shorts")
  ) {
    return "youtube";
  }
  if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) {
    return "twitter";
  }
  if (urlLower.includes("facebook.com") || urlLower.includes("fb.com")) {
    return "facebook";
  }
  if (urlLower.includes("pinterest.com") || urlLower.includes("pin.it")) {
    return "pinterest";
  }
  if (urlLower.includes("vimeo.com")) {
    return "vimeo";
  }
  if (urlLower.includes("twitch.tv")) {
    return "twitch";
  }
  if (urlLower.includes("reddit.com")) {
    return "reddit";
  }

  return "unknown";
}

/**
 * Check if platform is supported
 */
export function isPlatformSupported(platform: Platform): boolean {
  const supportedPlatforms: Platform[] = [
    "tiktok",
    "instagram",
    "youtube",
    "twitter",
    "facebook",
    "pinterest",
    "vimeo",
    "twitch",
    "reddit",
  ];
  return supportedPlatforms.includes(platform);
}

/**
 * Get platform display name
 */
export function getPlatformName(platform: Platform): string {
  const names: Record<Platform, string> = {
    tiktok: "TikTok",
    instagram: "Instagram",
    youtube: "YouTube",
    twitter: "Twitter/X",
    facebook: "Facebook",
    pinterest: "Pinterest",
    vimeo: "Vimeo",
    twitch: "Twitch",
    reddit: "Reddit",
    unknown: "Unknown",
  };
  return names[platform] || "Unknown";
}

