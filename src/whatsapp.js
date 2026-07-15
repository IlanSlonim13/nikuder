const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { config } = require('./config');

function createClient() {
  const puppeteerArgs = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };

  if (config.puppeteerExecutablePath) {
    puppeteerArgs.executablePath = config.puppeteerExecutablePath;
  }

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerArgs,
  });

  client.on('qr', (qr) => {
    console.log('\nScan this QR code with WhatsApp > Linked Devices > Link a Device:\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', async () => {
    console.log('\n✅ WhatsApp connected!\n');
    try {
      await listGroups(client);
    } catch (err) {
      console.error('[whatsapp] Could not list groups:', err.message || err);
      console.error('[whatsapp] The bot is still running; message forwarding is unaffected.');
    }
  });

  client.on('auth_failure', (msg) => {
    console.error('[whatsapp] Authentication failed:', msg);
    console.error('Delete the .wwebjs_auth folder and try again.');
  });

  client.on('disconnected', (reason) => {
    console.warn('[whatsapp] Disconnected:', reason);
    console.log('[whatsapp] Attempting to reconnect...');
    client.initialize();
  });

  return client;
}

async function getGroups(client) {
  // Primary path: whatsapp-web.js getChats(). It serializes every chat in one
  // shot, so a single chat that fails to serialize (e.g. a channel/newsletter
  // with missing fields) throws for the whole call. Fall back to reading the
  // Store directly, guarding each chat, if that happens.
  try {
    const chats = await client.getChats();
    return chats
      .filter(chat => chat.isGroup)
      .map(g => ({ name: g.name, id: g.id._serialized }));
  } catch (err) {
    console.warn('[whatsapp] getChats() failed, falling back to Store query:', err.message || err);
    return client.pupPage.evaluate(() => {
      const out = [];
      for (const chat of window.Store.Chat.getModelsArray()) {
        try {
          if (!chat.id || !chat.id.isGroup()) continue;
          out.push({
            name: chat.formattedTitle || chat.name || chat.id.user,
            id: chat.id._serialized,
          });
        } catch (_) { /* skip chats that fail to read */ }
      }
      return out;
    });
  }
}

async function listGroups(client) {
  const groups = await getGroups(client);

  if (groups.length === 0) {
    console.log('No groups found.\n');
    return;
  }

  // Calculate column widths
  const nameHeader = 'Group Name';
  const idHeader = 'Group ID';
  const maxName = Math.max(nameHeader.length, ...groups.map(g => g.name.length));
  const maxId = Math.max(idHeader.length, ...groups.map(g => g.id.length));

  const pad = (str, len) => str + ' '.repeat(Math.max(0, len - str.length));
  const line = (l, m, r, fill) => l + fill.repeat(maxName + 2) + m + fill.repeat(maxId + 2) + r;

  console.log('Your groups:');
  console.log(line('┌', '┬', '┐', '─'));
  console.log(`│ ${pad(nameHeader, maxName)} │ ${pad(idHeader, maxId)} │`);
  console.log(line('├', '┼', '┤', '─'));

  for (const group of groups) {
    console.log(`│ ${pad(group.name, maxName)} │ ${pad(group.id, maxId)} │`);
  }

  console.log(line('└', '┴', '┘', '─'));
  console.log('\nCopy the IDs into your .env file.\n');
}

module.exports = { createClient };
