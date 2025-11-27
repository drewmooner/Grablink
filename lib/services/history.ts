// History service - stores download history (links only, no files)

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

interface HistoryEntry {
  id: string;
  url: string;
  platform: string;
  title: string;
  author: string;
  thumbnail?: string;
  format: "video" | "audio";
  quality?: string;
  downloadedAt: number;
  downloadId?: string; // Reference to download if still available
  fileSize?: number; // File size in bytes
  duration?: number; // Video duration in seconds
}

// File-based history storage (persists across restarts)
const HISTORY_DIR = path.join(os.tmpdir(), "grablink-history");
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");

// In-memory cache for quick access
const historyStore = new Map<string, HistoryEntry[]>();

// Ensure history directory exists
async function ensureHistoryDir(): Promise<void> {
  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
}

// Load history from file
async function loadHistoryFromFile(): Promise<void> {
  try {
    await ensureHistoryDir();
    const data = await fs.readFile(HISTORY_FILE, "utf-8");
    const stored = JSON.parse(data);
    
    // Restore to in-memory store
    for (const [key, entries] of Object.entries(stored)) {
      historyStore.set(key, entries as HistoryEntry[]);
    }
  } catch (error) {
    // File doesn't exist yet or is invalid, start fresh
    historyStore.clear();
  }
}

// Save history to file
async function saveHistoryToFile(): Promise<void> {
  try {
    await ensureHistoryDir();
    const data: Record<string, HistoryEntry[]> = {};
    
    for (const [key, entries] of historyStore.entries()) {
      data[key] = entries;
    }
    
    await fs.writeFile(HISTORY_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save history to file:", error);
  }
}

// Load history on startup
loadHistoryFromFile().catch(console.error);

// Cleanup old history entries (older than 30 days)
const HISTORY_RETENTION_DAYS = 30;
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

setInterval(() => {
  const cutoffTime = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  
  for (const [key, entries] of historyStore.entries()) {
    const filtered = entries.filter((entry) => entry.downloadedAt > cutoffTime);
    if (filtered.length === 0) {
      historyStore.delete(key);
    } else {
      historyStore.set(key, filtered);
    }
  }
  
  // Save cleaned history to file
  saveHistoryToFile().catch(console.error);
}, CLEANUP_INTERVAL);

/**
 * Get history key from IP address and User-Agent for better isolation
 */
function getHistoryKey(ip?: string, userAgent?: string): string {
  // Create a unique key from IP + User-Agent to ensure proper isolation
  // This prevents users from seeing each other's history
  const ipPart = ip && ip !== "unknown" ? ip : "no-ip";
  const uaPart = userAgent ? userAgent.substring(0, 50).replace(/[^a-zA-Z0-9]/g, "") : "no-ua";
  
  // Create a hash-like key from IP and User-Agent
  // This ensures each user gets their own history even if IP is shared (NAT/proxy)
  const combined = `${ipPart}_${uaPart}`;
  
  // Use a simple hash to keep key length reasonable
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `user_${Math.abs(hash).toString(36)}`;
}

/**
 * Add entry to history
 */
export async function addToHistory(
  entry: Omit<HistoryEntry, "id" | "downloadedAt">,
  ip?: string,
  userAgent?: string
): Promise<string> {
  const historyKey = getHistoryKey(ip, userAgent);
  const history = historyStore.get(historyKey) || [];

  const newEntry: HistoryEntry = {
    ...entry,
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    downloadedAt: Date.now(),
  };

  history.unshift(newEntry); // Add to beginning

  // Keep only last 500 entries per user (increased from 100)
  if (history.length > 500) {
    history.splice(500);
  }

  historyStore.set(historyKey, history);

  // Save to file asynchronously (don't wait, don't throw)
  saveHistoryToFile().catch((error) => {
    console.error("[addToHistory] Failed to save history to file:", error);
    // Don't throw - history saving failure shouldn't break the download
  });

  return newEntry.id;
}

/**
 * Get history for a user
 */
export async function getHistory(ip?: string, limit: number = 50, userAgent?: string): Promise<HistoryEntry[]> {
  // Ensure history is loaded from file
  if (historyStore.size === 0) {
    await loadHistoryFromFile();
  }
  
  const historyKey = getHistoryKey(ip, userAgent);
  const history = historyStore.get(historyKey) || [];
  
  return history.slice(0, limit);
}

/**
 * Get single history entry by ID
 */
export function getHistoryEntry(id: string, ip?: string, userAgent?: string): HistoryEntry | null {
  const historyKey = getHistoryKey(ip, userAgent);
  const history = historyStore.get(historyKey) || [];
  
  return history.find((entry) => entry.id === id) || null;
}

/**
 * Clear history for a user
 */
export async function clearHistory(ip?: string, userAgent?: string): Promise<void> {
  const historyKey = getHistoryKey(ip, userAgent);
  historyStore.delete(historyKey);
  
  // Save to file
  await saveHistoryToFile();
}

/**
 * Delete single history entry
 */
export async function deleteHistoryEntry(id: string, ip?: string, userAgent?: string): Promise<boolean> {
  const historyKey = getHistoryKey(ip, userAgent);
  const history = historyStore.get(historyKey) || [];
  
  const index = history.findIndex((entry) => entry.id === id);
  if (index !== -1) {
    history.splice(index, 1);
    historyStore.set(historyKey, history);
    
    // Save to file
    await saveHistoryToFile();
    return true;
  }
  
  return false;
}

