const { config } = require('./config');

const DICTA_API_URL = 'https://nakdan-5-1.loadbalancer.dicta.org.il/api';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const TIMEOUT_MS = 10000;

let hasLoggedRawResponse = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call the Dicta Nakdan API to add nikud to Hebrew text.
 * Retries up to MAX_RETRIES times on failure.
 * Returns original text with ⚠️ marker if all retries fail.
 */
async function addNikud(text) {
  const body = JSON.stringify({
    task: 'nakdan',
    data: text,
    genre: 'modern',
    addmorph: false,
    matchaliases: false,
    keepaliases: false,
    keepaliaseargs: false,
    newaliases: false,
    moraliases: false,
    keepaliasargs: false,
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(DICTA_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Dicta API returned ${response.status}`);
      }

      const data = await response.json();

      if (!hasLoggedRawResponse && config.logLevel === 'debug') {
        console.log('[DEBUG] Raw Dicta API response:', JSON.stringify(data, null, 2));
        hasLoggedRawResponse = true;
      }

      return parseNikudResponse(data, text);
    } catch (err) {
      const isLastAttempt = attempt === MAX_RETRIES;
      console.error(`[nikud] API error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${err.message}`);

      if (isLastAttempt) {
        console.error('[nikud] All retries failed, returning original text');
        return `${text}\n⚠️ לא הצלחתי להוסיף ניקוד`;
      }

      await sleep(RETRY_DELAY_MS);
    }
  }
}

/**
 * Parse the Dicta Nakdan API response and extract nikud text.
 * The API returns an array of word objects.
 */
function parseNikudResponse(data, originalText) {
  try {
    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      // API returns array of items. Each has:
      //   word: original text, sep: bool (separator like space/punctuation),
      //   options: array of strings (nikud variants, first is best)
      // For separators, options is empty — use the original word.
      const parts = data.map(item => {
        if (item.sep || !item.options || item.options.length === 0) {
          return item.word || '';
        }
        // options[0] is the best nikud form (a plain string)
        return typeof item.options[0] === 'string'
          ? item.options[0]
          : item.word || '';
      });

      const result = parts.join('');
      if (result.trim()) {
        return result;
      }
    }

    console.warn('[nikud] Unexpected response format, returning original text. Response:', JSON.stringify(data).slice(0, 500));
    return originalText;
  } catch (err) {
    console.error('[nikud] Error parsing response:', err.message);
    return originalText;
  }
}

module.exports = { addNikud };
