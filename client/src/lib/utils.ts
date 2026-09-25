import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatCurrency as sharedFormatCurrency, formatDate as sharedFormatDate } from "@shared/utils"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string): string {
  return sharedFormatCurrency(amount);
}

export function formatDate(date: string | Date): string {
  return sharedFormatDate(date);
}

/**
 * Deep Arabic and Universal Text Normalization for high-accuracy Google Maps-like search
 */
export function normalizeArabicText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    // Remove Arabic diacritics / tashkeel (Fatha, Damma, Kasra, Shadda, Sukun, Tanween, etc.)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    // Remove Tatweel (Kashida)
    .replace(/\u0640/g, "")
    // Normalize Alef variations (أ, إ, آ, ٱ -> ا)
    .replace(/[أإآٱ]/g, "ا")
    // Normalize Taa Marbuta to Haa (ة -> ه) for fuzzy tolerance
    .replace(/ة/g, "ه")
    // Normalize Alef Maqsura to Yaa (ى -> ي)
    .replace(/ى/g, "ي")
    // Normalize Waw with Hamza (ؤ -> و)
    .replace(/ؤ/g, "و")
    // Normalize Yaa with Hamza (ئ -> ي)
    .replace(/ئ/g, "ي")
    // Normalize Persian/Urdu letters if any
    .replace(/[پ]/g, "ب")
    .replace(/[چ]/g, "ج")
    .replace(/[گ]/g, "ك")
    // Remove special punctuation but keep letters and numbers
    .replace(/[^\w\s\u0621-\u064A0-9]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * High-accuracy multi-field search matcher with tokenization and Arabic character sensitivity
 */
export function matchesSearchQuery(targets: (string | null | undefined)[], query: string): boolean {
  if (!query || !query.trim()) return true;
  
  const rawQuery = query.trim().toLowerCase();
  const normQuery = normalizeArabicText(query);
  if (!normQuery) return true;

  const queryTokens = normQuery.split(" ").filter(t => t.length > 0);

  // Check against all target fields
  const combinedRaw = targets.filter(Boolean).map(t => String(t).toLowerCase()).join(" ");
  const combinedNorm = targets.filter(Boolean).map(t => normalizeArabicText(String(t))).join(" ");

  // 1. Direct raw substring match
  if (combinedRaw.includes(rawQuery)) return true;

  // 2. Normalized full substring match
  if (combinedNorm.includes(normQuery)) return true;

  // 3. Multi-token match: all tokens must appear in the combined normalized string
  if (queryTokens.length > 1) {
    const allTokensFound = queryTokens.every(token => combinedNorm.includes(token));
    if (allTokensFound) return true;
  }

  // 4. Token-by-token fuzzy prefix match
  for (const token of queryTokens) {
    if (token.length >= 2 && combinedNorm.includes(token)) {
      return true;
    }
  }

  return false;
}

/**
 * Parses coordinates directly from Google Maps URLs, Shortlinks, or raw coordinates
 */
export function extractCoordsFromTextOrUrl(input: string): { lat: number; lng: number; title?: string } | null {
  if (!input) return null;
  const str = input.trim();

  // 1. Raw coordinates "15.3694, 44.1910"
  const rawCoord = str.match(/^[-+]?([0-8]?\d(?:\.\d+)?|90(?:\.0+)?)[,\s]+[-+]?(180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?)$/);
  if (rawCoord) {
    const lat = parseFloat(rawCoord[1]);
    const lng = parseFloat(rawCoord[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  // 2. DMS coordinates e.g. 15°22'09.8"N 44°11'27.6"E
  const dmsMatch = str.match(/(\d+)°(\d+)'([\d.]+)"([NSEWnsew])\s*,?\s*(\d+)°(\d+)'([\d.]+)"([NSEWnsew])/);
  if (dmsMatch) {
    let lat = parseInt(dmsMatch[1], 10) + parseInt(dmsMatch[2], 10) / 60 + parseFloat(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === "S") lat = -lat;
    let lng = parseInt(dmsMatch[5], 10) + parseInt(dmsMatch[6], 10) / 60 + parseFloat(dmsMatch[7]) / 3600;
    if (dmsMatch[8].toUpperCase() === "W") lng = -lng;
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  let title: string | undefined;
  const placeTitleMatch = str.match(/\/place\/([^/@?]+)/);
  if (placeTitleMatch) {
    try {
      title = decodeURIComponent(placeTitleMatch[1].replace(/\+/g, " "));
    } catch (e) {}
  }

  // 3. Google Maps @lat,lng
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, title };
    }
  }

  // 4. URL query parameters ?q=lat,lng, query=lat,lng, ll=lat,lng, daddr=lat,lng
  const paramMatch = str.match(/[?&](?:q|query|daddr|saddr|ll|destination|center)=(-?\d+\.\d+)[,%20\s]+(-?\d+\.\d+)/i);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, title };
    }
  }

  // 5. Path coordinates /dir//15.3694,44.1910
  const dirMatch = str.match(/\/(?:dir|search)\/[^/]*\/(-?\d+\.\d+)[,%20\s]+(-?\d+\.\d+)/i);
  if (dirMatch) {
    const lat = parseFloat(dirMatch[1]);
    const lng = parseFloat(dirMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, title };
    }
  }

  // 6. Geo URI geo:15.3694,44.1910
  const geoMatch = str.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/i);
  if (geoMatch) {
    const lat = parseFloat(geoMatch[1]);
    const lng = parseFloat(geoMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

