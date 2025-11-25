// Core scraping functionality using axios and cheerio

import axios, { AxiosRequestConfig } from "axios";
import * as cheerio from "cheerio";
import { getRandomUserAgent } from "./utils/userAgent";
import { resolveUrl, removeDuplicateUrls, isValidUrl } from "./utils/url";
import type { ExtractedLink, PageMetadata, ExtractRequest } from "./types";

/**
 * Fetch HTML content from a URL
 */
async function fetchHtml(url: string): Promise<string> {
  const userAgent = getRandomUserAgent();

  const config: AxiosRequestConfig = {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
    timeout: 30000, // 30 seconds timeout
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  };

  const response = await axios.get(url, config);
  return response.data;
}

/**
 * Extract links from HTML content
 */
function extractLinks(
  html: string,
  baseUrl: string,
  options: ExtractRequest["options"] = {}
): ExtractedLink[] {
  const $ = cheerio.load(html);
  const links: ExtractedLink[] = [];
  const seenUrls = new Set<string>();

  // Extract all anchor tags
  $("a[href]").each((_, element) => {
    const $el = $(element);
    const href = $el.attr("href");
    if (!href) return;

    // Resolve relative URLs to absolute
    const absoluteUrl = resolveUrl(href, baseUrl);
    if (!absoluteUrl || !isValidUrl(absoluteUrl)) return;

    // Check for duplicates if option is enabled
    if (options.filterDuplicates) {
      const normalized = absoluteUrl.toLowerCase().replace(/\/$/, "");
      if (seenUrls.has(normalized)) return;
      seenUrls.add(normalized);
    }

    const link: ExtractedLink = {
      url: absoluteUrl,
      text: $el.text().trim() || absoluteUrl,
      title: $el.attr("title") || undefined,
      rel: $el.attr("rel") || undefined,
      target: $el.attr("target") || undefined,
    };

    links.push(link);

    // Apply max links limit if specified
    if (options.maxLinks && links.length >= options.maxLinks) {
      return false; // Break the loop
    }
  });

  // Remove duplicates if not already filtered
  if (!options.filterDuplicates && links.length > 0) {
    const uniqueUrls = removeDuplicateUrls(links.map((l) => l.url));
    return links.filter((link) => uniqueUrls.includes(link.url));
  }

  return links;
}

/**
 * Extract page metadata from HTML
 */
function extractMetadata(html: string, baseUrl: string): PageMetadata {
  const $ = cheerio.load(html);
  const metadata: PageMetadata = {};

  // Title
  metadata.title = $("title").text().trim() || undefined;

  // Meta description
  metadata.description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    undefined;

  // Open Graph tags
  metadata.ogTitle = $('meta[property="og:title"]').attr("content") || undefined;
  metadata.ogDescription = $('meta[property="og:description"]').attr("content") || undefined;
  metadata.ogImage = $('meta[property="og:image"]').attr("content") || undefined;

  // Canonical URL
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical) {
    metadata.canonicalUrl = resolveUrl(canonical, baseUrl) || undefined;
  }

  return metadata;
}

/**
 * Main function to extract links from a URL
 */
export async function extractLinksFromUrl(request: ExtractRequest) {
  const { url, options = {} } = request;

  // Validate URL
  if (!isValidUrl(url)) {
    throw new Error("Invalid URL provided");
  }

  try {
    // Fetch HTML
    const html = await fetchHtml(url);

    // Extract links
    const links = extractLinks(html, url, options);

    // Extract metadata if requested
    const metadata = options.includeMetadata ? extractMetadata(html, url) : undefined;

    return {
      success: true,
      url,
      links,
      metadata,
      totalLinks: links.length,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        throw new Error("Request timeout - the server took too long to respond");
      }
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      }
      if (error.request) {
        throw new Error("Network error - could not reach the server");
      }
    }
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

