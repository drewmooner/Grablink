// Platform detection utility

import type { Platform } from "@/lib/types";

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): Platform {
  const urlLower = url.toLowerCase();

  // Explicitly detect and reject TikTok URLs early
  if (urlLower.includes("tiktok.com") || urlLower.includes("vm.tiktok.com") || urlLower.includes("vt.tiktok.com")) {
    return "unknown"; // Return unknown so it's caught by platform check
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

