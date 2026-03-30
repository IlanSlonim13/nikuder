# WhatsApp Nikud Bot — Full Build Spec

## Mission

Build a Node.js bot that:
1. Connects to WhatsApp via `whatsapp-web.js`
2. Listens for new messages in a **source** WhatsApp group
3. Adds Hebrew nikud (vowel diacritics / ניקוד) to every Hebrew message using the **Dicta Nakdan API**
4. Forwards the nikud-annotated text to a **target** WhatsApp group
5. Provides a minimal status dashboard (optional but nice)

The user will scan a QR code from their terminal to authenticate WhatsApp. No WhatsApp Business API is needed.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (v18+) |
| WhatsApp client | `whatsapp-web.js` |
| Nikud engine | Dicta Nakdan REST API (`https://nakdan-5-1.loadbalancer.dicta.org.il/api`) |
| Config | `.env` file via `dotenv` |
| Logging | `winston` or simple `console` with timestamps |
| QR display | `qrcode-terminal` (prints QR in terminal) |

---

## Project Structure

```
whatsapp-nikud-bot/
├── .env                  # config (group IDs, options)
├── .env.example          # template
├── .gitignore
├── package.json
├── src/
│   ├── index.js          # entry point — boots WhatsApp client
│   ├── whatsapp.js       # WhatsApp connection, auth, message listener
│   ├── nikud.js          # Dicta Nakdan API integration
│   ├── hebrew.js         # utility: detect Hebrew text, filter, clean
│   └── config.js         # loads and validates .env
└── README.md             # setup + usage instructions
```

---

## Detailed Module Specs

### 1. `src/config.js`

Load from `.env`:

```
# WhatsApp group IDs (get these from the bot's console log on first run)
SOURCE_GROUP_ID=120363012345678901@g.us
TARGET_GROUP_ID=120363098765432101@g.us

# Options
FORWARD_NON_HEBREW=false        # forward messages that aren't Hebrew?
ADD_ORIGINAL_TEXT=true           # include original text above the nikud version?
BOT_TAG=[ניקוד]                 # prefix tag on forwarded messages
LOG_LEVEL=info
```

Validate that SOURCE_GROUP_ID and TARGET_GROUP_ID are set. Throw clear errors if not.

### 2. `src/whatsapp.js`

- Use `whatsapp-web.js` `Client` with `LocalAuth` strategy (persists session so QR scan is only needed once).
- On `qr` event → print QR to terminal using `qrcode-terminal`.
- On `ready` event → log success, list all groups with their IDs so user can find the correct group IDs. Print them in a clear table format:
  ```
  ✅ WhatsApp connected!
  
  Your groups:
  ┌──────────────────────────┬────────────────────────────┐
  │ Group Name               │ Group ID                   │
  ├──────────────────────────┼────────────────────────────┤
  │ Family Chat              │ 120363012345678901@g.us    │
  │ Hebrew Practice          │ 120363098765432101@g.us    │
  └──────────────────────────┴────────────────────────────┘
  
  Copy the IDs into your .env file.
  ```
- On `message` event:
  - Ignore messages from the bot itself (check `message.fromMe`).
  - Check if `message.from === SOURCE_GROUP_ID`.
  - If yes, extract `message.body` (text content only — ignore media for now).
  - Check if text contains Hebrew characters (use `hebrew.js`).
  - If Hebrew: send to `nikud.js` for annotation → send result to TARGET_GROUP_ID.
  - If not Hebrew and `FORWARD_NON_HEBREW=true`: forward as-is.
- On `auth_failure` and `disconnected` → log and attempt reconnect.

### 3. `src/nikud.js`

Use the **Dicta Nakdan API**:

```
POST https://nakdan-5-1.loadbalancer.dicta.org.il/api
Content-Type: application/json

{
  "task": "nakdan",
  "data": "שלום עולם",
  "genre": "modern",
  "addmorph": false,
  "matchaliases": false,
  "keepaliases": false,
  "keepaliaseargs": false,
  "newaliases": false,
  "moraliases": false,
  "keepaliasargs": false
}
```

**Response handling:**
- The API returns an array of word objects. Each word object has:
  - `word` — original word
  - `options` — array of possible nikud results
  - The first option's `nakpiData.finalWord` or similar field contains the nikud version
- **Important:** The response format may vary. The module should:
  1. Make the POST request
  2. Parse the response robustly — log the raw response on first run so the user can inspect the structure
  3. Extract the nikud-annotated text
  4. Return it as a single string
- Add retry logic (2 retries with 1-second delay) for transient failures.
- Add a timeout of 10 seconds.
- If the API fails after retries, return the original text with a ⚠️ marker.

**CRITICAL:** On first run, log the full raw API response for ONE message so the developer can verify the parsing is correct. Gate this behind `LOG_LEVEL=debug`.

### 4. `src/hebrew.js`

```js
// Detect if a string contains Hebrew characters
function containsHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}

// Detect if text already has nikud
function hasNikud(text) {
  return /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/.test(text);
}

// Strip nikud from text (useful for testing)
function stripNikud(text) {
  return text.replace(/[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
}
```

### 5. `src/index.js`

- Load config
- Initialize WhatsApp client
- Set up message handler pipeline:
  1. Filter: is it from the source group?
  2. Filter: is it text? Contains Hebrew?
  3. Transform: add nikud via Dicta
  4. Format: compose the outgoing message
  5. Send: push to target group

**Message format in target group:**

```
[ניקוד] מישהו כתב:

שָׁלוֹם עוֹלָם
```

If `ADD_ORIGINAL_TEXT=true`:

```
[ניקוד]

📝 מקור: שלום עולם
✨ ניקוד: שָׁלוֹם עוֹלָם
```

---

## Setup Flow (for README.md)

```bash
# 1. Clone and install
cd whatsapp-nikud-bot
npm install

# 2. First run — discover group IDs
cp .env.example .env
node src/index.js
# → Scan QR code with your phone
# → Bot prints all group names + IDs
# → Copy the source and target group IDs

# 3. Configure
# Edit .env with the correct group IDs

# 4. Run for real
node src/index.js
# → Bot is now listening and forwarding with nikud!
```

---

## Error Handling Requirements

1. **No WhatsApp auth**: Clear message saying "Scan the QR code with WhatsApp > Linked Devices > Link a Device"
2. **Group not found**: If SOURCE or TARGET group ID doesn't match any group, list available groups and exit
3. **Dicta API down**: Forward original text with a note: "⚠️ לא הצלחתי להוסיף ניקוד"
4. **Rate limiting**: Add a 500ms delay between API calls if multiple messages arrive at once (use a simple queue)
5. **Empty messages / media**: Skip silently

---

## Dependencies (package.json)

```json
{
  "name": "whatsapp-nikud-bot",
  "version": "1.0.0",
  "description": "WhatsApp bot that adds nikud to Hebrew messages",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "dependencies": {
    "whatsapp-web.js": "^1.26.0",
    "qrcode-terminal": "^0.12.0",
    "dotenv": "^16.4.5"
  }
}
```

Note: `whatsapp-web.js` may also need `puppeteer` or `puppeteer-core` — install whichever it requires. If on Windows and Chromium download fails, use puppeteer-core with an existing Chrome installation and set `PUPPETEER_EXECUTABLE_PATH` in .env.

---

## Testing Plan

1. **Unit test nikud.js**: Send "שלום עולם" to Dicta → verify nikud comes back
2. **Unit test hebrew.js**: Test detection on mixed Hebrew/English strings
3. **Integration test**: Send a test message in source group → verify nikud message appears in target group
4. **Edge cases**:
   - Message with only emojis → skip
   - Message with mixed Hebrew/English → nikud only the Hebrew parts
   - Message already has nikud → skip or re-process (configurable)
   - Very long message (>1000 chars) → split into chunks for API if needed

---

## Nice-to-Have (Phase 2)

- [ ] Support voice messages (transcribe → nikud → send text)
- [ ] Web dashboard showing message count, last processed, errors
- [ ] Support multiple source groups
- [ ] Inline mode: react to messages in the SAME group with nikud reply
- [ ] Persist message log to SQLite

---

## Important Notes for Claude Code

- **Start by getting WhatsApp connected and listing groups.** Don't try to do everything at once. Get QR auth working first, print groups, then wire up the message listener, then add Dicta integration.
- **Log the raw Dicta API response** on the first successful call so we can verify the parsing logic. The API response structure is not perfectly documented.
- **Use `LocalAuth`** from whatsapp-web.js so the session persists and the user doesn't need to re-scan QR every time.
- **The Dicta Nakdan API is free and requires no API key.** Just POST to the endpoint.
- **Hebrew text direction**: WhatsApp handles RTL natively, so no special handling needed in the bot.
- **Run this on Windows** — the developer uses Windows. Use path separators that work on Windows. Avoid Unix-only shell commands in scripts.
