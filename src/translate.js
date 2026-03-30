const { config } = require('./config');

const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const TIMEOUT_MS = 10000;

/**
 * Translate text using Google Translate's free endpoint.
 * Uses SOURCE_LANG and TARGET_LANG from config by default.
 * Returns null on failure.
 */
async function translate(text, { from, to } = {}) {
  const sourceLang = from || config.sourceLang;
  const targetLang = to || config.targetLang;

  try {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: sourceLang,
      tl: targetLang,
      dt: 't',
      q: text,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${GOOGLE_TRANSLATE_URL}?${params}`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Google Translate returned ${response.status}`);
    }

    const data = await response.json();

    // Response is nested arrays: [[["translated","original",...],...],...]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0]
        .filter(segment => segment && segment[0])
        .map(segment => segment[0])
        .join('');
    }

    return null;
  } catch (err) {
    console.error('[translate] Error:', err.message);
    return null;
  }
}

module.exports = { translate };
