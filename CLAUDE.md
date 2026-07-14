# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

WhatsApp bot that listens for messages in a configurable source language across multiple groups, adds Hebrew nikud (when source is Hebrew) via the Dicta Nakdan API, translates to a configurable target language via Google Translate, and forwards to a target group. Uses `whatsapp-web.js` with QR-code authentication.

## Commands

- `npm start` — run the bot
- `npm run dev` — run with `--watch` for auto-restart on changes
- Entry point: `src/index.js`

## Architecture

**Message pipeline** (in `src/index.js`): `message_create` event (fires for incoming messages and the user's own) → filter (source groups, skip the bot's own forwards to the target group, has text or media) → source language detection → nikud if Hebrew → translate → format → send to target group (media forwarded with the formatted text as caption).

- **src/config.js** — loads `.env` via dotenv, validates required group IDs. Supports discovery mode (no group IDs) on first run. Language pair configured via `SOURCE_LANG`/`TARGET_LANG`.
- **src/whatsapp.js** — creates `whatsapp-web.js` Client with `LocalAuth` (session in `.wwebjs_auth/`). QR display, group listing, reconnection.
- **src/nikud.js** — Dicta Nakdan REST API. Retry logic (2 retries, 1s delay), 10s timeout. Only used when `SOURCE_LANG=he`.
- **src/language.js** — Unicode script range detection for multiple languages (Hebrew, Arabic, Russian, Chinese, etc.). Falls back to processing all messages for Latin-script languages.
- **src/hebrew.js** — Hebrew-specific utilities: `containsHebrew`, `hasNikud`, `stripNikud`.
- **src/translate.js** — Google Translate free endpoint. Configurable source/target language pair.
- **Rate limiting** — queue in `index.js` enforces 500ms delay between API calls.

## Key Notes

- The Dicta Nakdan API is free and requires no API key.
- `.env` contains secret group IDs — only `.env.example` is committed.
- Session data lives in `.wwebjs_auth/` (gitignored). Deleting it requires re-scanning the QR code.
- On Windows, if Puppeteer's Chromium download fails, set `PUPPETEER_EXECUTABLE_PATH` in `.env`.
