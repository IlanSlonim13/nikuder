const { config, validate } = require('./config');
const { createClient } = require('./whatsapp');
const { MessageMedia } = require('whatsapp-web.js');
const { addNikud } = require('./nikud');
const { containsLanguage } = require('./language');
const { translate } = require('./translate');

const isHebrew = config.sourceLang === 'he';

async function resolveSenderName(client, message) {
  try {
    const authorId = message.author || message.from;

    if (message.fromMe || (authorId && client.info && authorId === client.info.wid._serialized)) {
      const name = client.info.pushname || client.info.me?.user || null;
      if (name) return name;
    }

    if (authorId) {
      const contact = await client.getContactById(authorId);
      const name = contact.pushname || contact.name || contact.shortName || contact.verifiedName || contact.number;
      if (name) return name;
    }
  } catch (err) {
    console.warn('[bot] Could not resolve sender name:', err.message);
  }
  return null;
}

// Cache group names: groupId -> name
const groupNames = new Map();

async function resolveGroupName(client, groupId) {
  if (groupNames.has(groupId)) return groupNames.get(groupId);
  try {
    const chat = await client.getChatById(groupId);
    const name = chat.name || groupId;
    groupNames.set(groupId, name);
    return name;
  } catch {
    return groupId;
  }
}

// Simple message queue to enforce 500ms delay between API calls
const queue = [];
let processing = false;

async function processQueue(client) {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const { text, senderName, timestamp, groupName, media } = queue.shift();
    try {
      const nikudText = isHebrew && text ? await addNikud(text) : null;
      const formatted = await formatMessage(text, nikudText, senderName, timestamp, groupName);
      if (media) {
        await client.sendMessage(config.targetGroupId, media, { caption: formatted });
      } else {
        await client.sendMessage(config.targetGroupId, formatted);
      }
      console.log(`[bot] Forwarded message${media ? ' with media' : ''} from ${senderName}`);
    } catch (err) {
      console.error('[bot] Error processing message:', err.message);
    }

    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  processing = false;
}

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function formatMessage(original, nikudText, senderName, timestamp, groupName) {
  const time = formatTime(timestamp);
  const displayName = isHebrew && containsLanguage(senderName, 'he')
    ? await addNikud(senderName)
    : senderName;
  const translatedGroup = containsLanguage(groupName, config.sourceLang)
    ? await translate(groupName)
    : null;
  const displayGroup = translatedGroup ? `${groupName} (${translatedGroup})` : groupName;

  const header = `${config.botTag} ${displayName} | ${displayGroup} | ${time}`;

  if (!original) {
    return header;
  }

  const translation = await translate(original);
  const translationLine = translation ? `\n🔤 ${config.targetLang.toUpperCase()}: ${translation}` : '';

  if (config.addOriginalText && nikudText) {
    return `${header}\n\n📝 מקור: ${original}\n✨ ניקוד: ${nikudText}${translationLine}`;
  }
  if (config.addOriginalText) {
    return `${header}\n\n📝 Original: ${original}${translationLine}`;
  }
  if (nikudText) {
    return `${header}\n\n${nikudText}${translationLine}`;
  }
  return `${header}\n\n${original}${translationLine}`;
}

async function main() {
  let discoveryMode = false;
  try {
    validate();
  } catch (err) {
    console.log(`⚠️  ${err.message}`);
    console.log('Starting in discovery mode — connect to see your group IDs.\n');
    discoveryMode = true;
  }

  const client = createClient();

  client.on('ready', async () => {
    if (discoveryMode) {
      console.log('Running in discovery mode. Set SOURCE_GROUP_IDS and TARGET_GROUP_ID in .env, then restart.\n');
      return;
    }

    console.log(`[bot] Source language: ${config.sourceLang}, Target language: ${config.targetLang}`);
    if (isHebrew) console.log('[bot] Hebrew nikud is enabled');
    console.log(`[bot] Listening for messages in source groups: ${config.sourceGroupIds.join(', ')}`);
    console.log(`[bot] Forwarding to target group: ${config.targetGroupId}\n`);

    for (const id of config.sourceGroupIds) {
      await resolveGroupName(client, id);
    }

    for (const id of config.sourceGroupIds) {
      await forwardLatestMessage(client, id);
    }
  });

  // message_create fires for incoming messages AND messages sent from this
  // account (the plain 'message' event never fires for fromMe messages, so
  // the user's own messages in source groups would be silently dropped).
  client.on('message_create', async (message) => {
    if (discoveryMode) return;

    // For messages we send ourselves, `from` is our own ID and `to` is the chat.
    const chatId = message.fromMe ? message.to : message.from;

    // Never re-process the bot's own forwards into the target group.
    if (message.fromMe && chatId === config.targetGroupId) return;

    if (!config.sourceGroupIds.includes(chatId)) return;

    const text = message.body && message.body.trim() ? message.body : null;
    const hasMedia = message.hasMedia;

    // Skip messages with no text and no media
    if (!text && !hasMedia) return;

    const senderName = await resolveSenderName(client, message) || 'Unknown';
    const groupName = await resolveGroupName(client, chatId);

    // Download media if present
    let media = null;
    if (hasMedia) {
      try {
        media = await message.downloadMedia();
      } catch (err) {
        console.warn('[bot] Could not download media:', err.message);
      }
    }

    if (text && containsLanguage(text, config.sourceLang)) {
      queue.push({ text, senderName, timestamp: message.timestamp, groupName, media });
      processQueue(client);
    } else if (media) {
      // Photo with no source-language text — forward media with header only
      queue.push({ text, senderName, timestamp: message.timestamp, groupName, media });
      processQueue(client);
    } else if (text && config.forwardNonSourceLang) {
      try {
        await client.sendMessage(config.targetGroupId, `${config.botTag} ${senderName}:\n\n${text}`);
        console.log(`[bot] Forwarded non-${config.sourceLang} message from ${senderName}`);
      } catch (err) {
        console.error('[bot] Error forwarding message:', err.message);
      }
    }
  });

  await client.initialize();
}

async function forwardLatestMessage(client, sourceGroupId) {
  try {
    const groupName = await resolveGroupName(client, sourceGroupId);
    console.log(`[bot] Looking for latest ${config.sourceLang} message in "${groupName}"...`);

    const chat = await client.getChatById(sourceGroupId);
    if (!chat) {
      console.error(`[bot] Source group not found: ${sourceGroupId}`);
      return;
    }

    // Use pupPage directly to avoid Store.ConversationMsgs.loadEarlierMsgs, which
    // calls chat.waitForChatLoading() on an undefined chat when the local store
    // hasn't fully populated yet.
    const rawMessages = await client.pupPage.evaluate(async (chatId) => {
      const chatWid = window.Store.WidFactory.createWid(chatId);
      let chat = window.Store.Chat.get(chatWid);
      if (!chat) {
        const result = await window.Store.FindOrCreateChat.findOrCreateLatestChat(chatWid);
        chat = result?.chat;
      }
      if (!chat) return [];
      const msgs = chat.msgs?.getModelsArray() || [];
      return msgs
        .filter(m => !m.isNotification)
        .slice(-50)
        .map(m => ({
          id: m.id?._serialized,
          body: m.body || '',
          from: m.from?._serialized || m.id?.remote?._serialized || '',
          author: m.author?._serialized || '',
          timestamp: m.t || 0,
          fromMe: !!m.id?.fromMe,
          hasMedia: !!m.hasMedia,
          type: m.type || '',
        }));
    }, sourceGroupId);

    const messages = rawMessages;

    let latest = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.body && msg.body.trim() && containsLanguage(msg.body, config.sourceLang)) {
        latest = msg;
        break;
      }
    }

    if (!latest) {
      console.log(`[bot] No ${config.sourceLang} messages found in recent history.`);
      return;
    }

    const senderName = await resolveSenderName(client, latest) || 'Unknown';
    const nikudText = isHebrew ? await addNikud(latest.body) : null;
    const formatted = await formatMessage(latest.body, nikudText, senderName, latest.timestamp, groupName);

    let media = null;
    if (latest.hasMedia && latest.id) {
      try {
        const fullMsg = await client.getMessageById(latest.id);
        if (fullMsg) media = await fullMsg.downloadMedia();
      } catch (err) {
        console.warn('[bot] Could not download media:', err.message);
      }
    }

    if (media) {
      await client.sendMessage(config.targetGroupId, media, { caption: formatted });
    } else {
      await client.sendMessage(config.targetGroupId, formatted);
    }
    console.log(`[bot] Forwarded latest message from ${senderName}: "${latest.body.slice(0, 50)}..."`);
  } catch (err) {
    console.error('[bot] Error forwarding latest message:', err.message);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
