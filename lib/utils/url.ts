// URL utility functions

/**
 * Check if IP address is private/internal (SSRF protection)
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return true;
  }
  if (ip.startsWith("172.")) {
    const parts = ip.split(".");
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true; // 172.16.0.0 - 172.31.255.255
      }
    }
  }
  // IPv6 localhost
  if (ip === "::1" || ip === "localhost" || ip.startsWith("::ffff:127.")) {
    return true;
  }
  return false;
}

/**
 * Validate if a string is a valid URL and not a private/internal IP (SSRF protection)
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // Only allow http and https protocols
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    // SSRF Protection: Block private/internal IPs
    const hostname = url.hostname.toLowerCase();
    
    // Block localhost variations
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
      return false;
    }

    // Check if hostname is an IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      if (isPrivateIP(hostname)) {
        return false;
      }
    }

    // Block IPv6 localhost
    if (hostname === "[::1]" || hostname.startsWith("[::ffff:127.")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize URL - add protocol if missing, resolve relative URLs
 */
export function normalizeUrl(urlString: string, baseUrl?: string): string | null {
  try {
    // If it's already a valid absolute URL, return it
    if (isValidUrl(urlString)) {
      return urlString;
    }

    // If we have a base URL, try to resolve relative URL
    if (baseUrl && isValidUrl(baseUrl)) {
      const base = new URL(baseUrl);
      const resolved = new URL(urlString, base);
      return resolved.href;
    }

    // Try adding https:// if no protocol
    if (!urlString.startsWith("http://") && !urlString.startsWith("https://")) {
      return `https://${urlString}`;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve relative URLs to absolute URLs
 */
export function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    if (!href) return null;

    // Already absolute
    if (isValidUrl(href)) {
      return href;
    }

    // Resolve relative to base
    const base = new URL(baseUrl);
    const resolved = new URL(href, base);
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Remove duplicate URLs (case-insensitive, trailing slash insensitive)
 */
export function removeDuplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const normalized = new Map<string, string>();

  for (const url of urls) {
    const normalizedUrl = url.toLowerCase().replace(/\/$/, "");
    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      normalized.set(normalizedUrl, url);
    }
  }

  return Array.from(normalized.values());
}

