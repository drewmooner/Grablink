// Type definitions for the grablink application

export interface ExtractedLink {
  url: string;
  text: string;
  title?: string;
  rel?: string;
  target?: string;
}

export interface PageMetadata {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
}

export interface ExtractResponse {
  success: boolean;
  url: string;
  links: ExtractedLink[];
  metadata?: PageMetadata;
  totalLinks: number;
  error?: string;
}

export interface ExtractRequest {
  url: string;
  options?: {
    includeMetadata?: boolean;
    filterDuplicates?: boolean;
    maxLinks?: number;
  };
}

// Video download types
export type Platform = "tiktok" | "instagram" | "youtube" | "twitter" | "facebook" | "pinterest" | "vimeo" | "twitch" | "reddit" | "unknown";

export interface VideoQuality {
  quality: string;
  format: string;
  size: number;
  url: string;
  method: "direct" | "proxy";
  requiresProxy: boolean;
}

export interface VideoMetadata {
  title: string;
  author: {
    username: string;
    displayName?: string;
    avatar?: string;
  };
  description?: string;
  thumbnail?: string;
  duration?: number;
  views?: number;
  likes?: number;
  date?: string;
  hasWatermark?: boolean;
}

export interface AudioOnly {
  format: string;
  size: number;
  url: string;
  method: "direct" | "proxy";
}

export interface VideoInfoResponse {
  success: boolean;
  platform: Platform;
  url: string;
  metadata?: VideoMetadata;
  qualities: VideoQuality[];
  audioOnly?: AudioOnly;
  downloadOptions: {
    recommendedMethod: "direct" | "proxy";
    supportsDirect: boolean;
    supportsStreaming: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: object;
  };
}

export interface VideoDownloadRequest {
  url: string;
  quality?: string;
  format?: "video" | "audio";
  audioFormat?: "mp3" | "m4a";
  method?: "auto" | "direct" | "proxy";
}

export interface VideoDownloadResponse {
  success: boolean;
  downloadId?: string;
  historyId?: string;
  platform: Platform;
  video?: {
    quality: string;
    format: string;
    size: number;
    duration?: number;
    filename: string;
  };
  download?: {
    method: "direct" | "proxy";
    url: string;
    expiresAt?: string;
    directUrl?: string | null;
  };
  metadata?: {
    title: string;
    author: string;
  };
  error?: {
    code: string;
    message: string;
    details?: object;
  };
}

export interface HistoryEntry {
  id: string;
  url: string;
  platform: string;
  title: string;
  author: string;
  thumbnail?: string;
  format: "video" | "audio";
  quality?: string;
  downloadedAt: number;
  downloadId?: string;
  fileSize?: number; // File size in bytes
  duration?: number; // Video duration in seconds
}

export interface HistoryResponse {
  success: boolean;
  history: HistoryEntry[];
  total: number;
}

