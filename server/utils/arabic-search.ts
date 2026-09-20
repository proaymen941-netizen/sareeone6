/**
 * Enhanced Arabic Search Normalization and Matching Utility
 * Provides deep normalization for Arabic text (Alef variations, Taa Marbuta/Haa,
 * Yaa/Alef Maqsura, Tashkeel/Harakat, Tatweel, and Definite Article "ال").
 */

export function normalizeArabic(text: string | null | undefined): string {
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
    .replace(/ك/g, "ك")
    .replace(/ي/g, "ي")
    // Replace punctuation with spaces
    .replace(/[^\w\s\u0621-\u064A]/gi, " ")
    // Collapse multiple whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove Arabic definite article "ال" from start of word tokens
 */
export function stripDefiniteArticle(text: string): string {
  if (!text) return "";
  return text
    .split(" ")
    .map(word => {
      if (word.startsWith("ال") && word.length > 3) {
        return word.slice(2);
      }
      return word;
    })
    .join(" ");
}

/**
 * Calculate relevance score between a target text and a search query.
 * Returns a score > 0 if matched, or 0 if not matched.
 */
export function scoreArabicMatch(target: string | null | undefined, query: string): number {
  if (!target || !query) return 0;

  const rawTarget = target.trim().toLowerCase();
  const rawQuery = query.trim().toLowerCase();

  // 1. Exact raw match
  if (rawTarget === rawQuery) return 1000;
  if (rawTarget.startsWith(rawQuery)) return 800;
  if (rawTarget.includes(rawQuery)) return 600;

  // 2. Normalized Arabic match
  const normTarget = normalizeArabic(target);
  const normQuery = normalizeArabic(query);

  if (!normQuery) return 0;
  if (normTarget === normQuery) return 900;
  if (normTarget.startsWith(normQuery)) return 750;
  if (normTarget.includes(normQuery)) return 500;

  // 3. Match without definite article "ال"
  const targetNoAl = stripDefiniteArticle(normTarget);
  const queryNoAl = stripDefiniteArticle(normQuery);

  if (targetNoAl === queryNoAl) return 850;
  if (targetNoAl.startsWith(queryNoAl)) return 700;
  if (targetNoAl.includes(queryNoAl) || normTarget.includes(queryNoAl)) return 450;

  // 4. Multi-token / keyword matching (e.g. "شام كنافة" or "عربكة قشطة")
  const queryTokens = normQuery.split(" ").filter(t => t.length > 0);
  if (queryTokens.length > 1) {
    let matchedTokens = 0;
    for (const token of queryTokens) {
      const tokenNoAl = token.startsWith("ال") && token.length > 3 ? token.slice(2) : token;
      if (normTarget.includes(token) || targetNoAl.includes(tokenNoAl)) {
        matchedTokens++;
      }
    }
    if (matchedTokens === queryTokens.length) {
      return 400 + (matchedTokens * 50);
    }
    if (matchedTokens > 0) {
      return (matchedTokens / queryTokens.length) * 200;
    }
  }

  return 0;
}

/**
 * Quick boolean check if target matches query with Arabic tolerance
 */
export function matchesArabic(target: string | null | undefined, query: string): boolean {
  return scoreArabicMatch(target, query) > 0;
}
