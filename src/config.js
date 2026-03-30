const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  sourceGroupIds: (process.env.SOURCE_GROUP_IDS || process.env.SOURCE_GROUP_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),
  targetGroupId: process.env.TARGET_GROUP_ID,
  sourceLang: (process.env.SOURCE_LANG || 'he').toLowerCase(),
  targetLang: (process.env.TARGET_LANG || 'en').toLowerCase(),
  forwardNonSourceLang: process.env.FORWARD_NON_SOURCE_LANG === 'true' || process.env.FORWARD_NON_HEBREW === 'true',
  addOriginalText: process.env.ADD_ORIGINAL_TEXT !== 'false',
  botTag: process.env.BOT_TAG || '[ניקוד]',
  logLevel: process.env.LOG_LEVEL || 'info',
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
};

function validate() {
  if (config.sourceGroupIds.length === 0) {
    throw new Error('SOURCE_GROUP_IDS is not set in .env — run the bot once to discover group IDs');
  }
  if (!config.targetGroupId) {
    throw new Error('TARGET_GROUP_ID is not set in .env — run the bot once to discover group IDs');
  }
}

module.exports = { config, validate };
