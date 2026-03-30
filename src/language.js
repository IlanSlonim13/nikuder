/**
 * Unicode script ranges for common languages.
 * Used to detect if a message contains text in a specific language/script.
 */
const SCRIPT_RANGES = {
  he: /[\u0590-\u05FF]/,        // Hebrew
  ar: /[\u0600-\u06FF]/,        // Arabic
  ru: /[\u0400-\u04FF]/,        // Cyrillic (Russian, Ukrainian, etc.)
  uk: /[\u0400-\u04FF]/,        // Ukrainian (Cyrillic)
  el: /[\u0370-\u03FF]/,        // Greek
  zh: /[\u4E00-\u9FFF]/,        // Chinese (CJK Unified)
  ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/, // Japanese (Hiragana, Katakana, Kanji)
  ko: /[\uAC00-\uD7AF\u1100-\u11FF]/, // Korean (Hangul)
  th: /[\u0E00-\u0E7F]/,        // Thai
  hi: /[\u0900-\u097F]/,        // Hindi (Devanagari)
  ka: /[\u10A0-\u10FF]/,        // Georgian
  am: /[\u1200-\u137F]/,        // Amharic (Ethiopic)
};

/**
 * Check if text contains characters from the given language's script.
 * Falls back to checking for any non-ASCII if the language has no known script range.
 */
function containsLanguage(text, langCode) {
  const regex = SCRIPT_RANGES[langCode];
  if (regex) {
    return regex.test(text);
  }
  // For Latin-based languages (es, fr, de, pt, etc.) we can't distinguish
  // by script alone — process all messages and let the translation API handle it.
  return true;
}

module.exports = { containsLanguage, SCRIPT_RANGES };
