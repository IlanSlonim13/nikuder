# WhatsApp Nikud Bot

A WhatsApp bot that listens for messages in a source language across one or more groups, optionally adds Hebrew nikud (vowel diacritics / ניקוד), translates the message, and forwards everything to a target group.

## Features

- Detects messages in a configurable source language
- Adds Hebrew nikud via the [Dicta Nakdan API](https://dicta.org.il/) (when source language is Hebrew)
- Translates messages to a configurable target language via Google Translate
- Supports multiple source groups with a single target group
- Shows sender name, group name, and timestamp on every forwarded message
- Translates Hebrew group names and sender names automatically

## Supported Languages

Any language supported by Google Translate. Script-based detection works for: Hebrew (`he`), Arabic (`ar`), Russian (`ru`), Ukrainian (`uk`), Greek (`el`), Chinese (`zh`), Japanese (`ja`), Korean (`ko`), Thai (`th`), Hindi (`hi`), Georgian (`ka`), Amharic (`am`).

For Latin-script languages (English, Spanish, French, etc.), all messages are processed since script detection can't distinguish them.

## Prerequisites

- Node.js v18+
- A WhatsApp account

## Setup

```bash
# Install dependencies
npm install

# Create your config file
cp .env.example .env

# First run — discover your group IDs
npm start
# Scan the QR code with WhatsApp > Linked Devices > Link a Device
# The bot will print all your groups with their IDs
# Copy the source and target group IDs into .env
```

Edit `.env` with the correct group IDs and language settings, then restart:

```bash
npm start
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `SOURCE_GROUP_IDS` | — | Comma-separated WhatsApp group IDs to listen to (required) |
| `TARGET_GROUP_ID` | — | WhatsApp group ID to forward messages to (required) |
| `SOURCE_LANG` | `he` | Source language to detect ([ISO 639-1 code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)) |
| `TARGET_LANG` | `en` | Target language for translation (ISO 639-1 code) |
| `FORWARD_NON_SOURCE_LANG` | `false` | Forward messages not in the source language |
| `ADD_ORIGINAL_TEXT` | `true` | Include original text alongside processed version |
| `BOT_TAG` | `[ניקוד]` | Prefix tag on forwarded messages |
| `LOG_LEVEL` | `info` | Set to `debug` to log raw API responses |
| `PUPPETEER_EXECUTABLE_PATH` | — | Path to Chrome/Chromium (see Windows notes) |

## Example: Hebrew to English (default)

```env
SOURCE_LANG=he
TARGET_LANG=en
```

Forwarded message:
```
[ניקוד] Ilan | משפחה (Family) | 28.03.2026, 14:30

📝 מקור: שלום עולם
✨ ניקוד: שָׁלוֹם עוֹלָם
🔤 EN: Hello world
```

## Example: Arabic to French

```env
SOURCE_LANG=ar
TARGET_LANG=fr
BOT_TAG=[traduction]
```

## Windows Notes

If `npm install` fails to download Chromium for Puppeteer, install Chrome manually and set in `.env`:

```
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```
