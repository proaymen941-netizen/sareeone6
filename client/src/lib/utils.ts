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
