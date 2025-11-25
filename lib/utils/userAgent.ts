// Utility functions for generating random user agents

import randomUseragent from "random-useragent";
import UserAgent from "user-agents";

/**
 * Get a random user agent string
 * Uses random-useragent library as primary, falls back to user-agents
 */
export function getRandomUserAgent(): string {
  try {
    // Try random-useragent first
    const ua = randomUseragent.getRandom();
    if (ua) return ua;
  } catch (error) {
    console.warn("random-useragent failed, using user-agents fallback");
  }

  // Fallback to user-agents
  const userAgent = new UserAgent();
  return userAgent.toString();
}

/**
 * Get a random desktop user agent
 */
export function getDesktopUserAgent(): string {
  try {
    const ua = randomUseragent.getRandom((ua) => {
      return ua.browserName !== "Mobile Safari" && ua.deviceType === "Desktop";
    });
    if (ua) return ua;
  } catch (error) {
    // Fallback
  }

  const userAgent = new UserAgent({ deviceCategory: "desktop" });
  return userAgent.toString();
}

/**
 * Get a random mobile user agent
 */
export function getMobileUserAgent(): string {
  try {
    const ua = randomUseragent.getRandom((ua) => {
      return ua.deviceType === "Mobile";
    });
    if (ua) return ua;
  } catch (error) {
    // Fallback
  }

  const userAgent = new UserAgent({ deviceCategory: "mobile" });
  return userAgent.toString();
}

