/**
 * Detect if a string contains Hebrew characters.
 */
function containsHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}

/**
 * Detect if text already has nikud (vowel diacritics).
 */
function hasNikud(text) {
  return /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/.test(text);
}

/**
 * Strip nikud from text.
 */
function stripNikud(text) {
  return text.replace(/[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
}

module.exports = { containsHebrew, hasNikud, stripNikud };
