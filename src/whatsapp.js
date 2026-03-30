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
    await listGroups(client);
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

async function listGroups(client) {
  const chats = await client.getChats();
  const groups = chats.filter(chat => chat.isGroup);

  if (groups.length === 0) {
    console.log('No groups found.\n');
    return;
  }

  // Calculate column widths
  const nameHeader = 'Group Name';
  const idHeader = 'Group ID';
  const maxName = Math.max(nameHeader.length, ...groups.map(g => g.name.length));
  const maxId = Math.max(idHeader.length, ...groups.map(g => g.id._serialized.length));

  const pad = (str, len) => str + ' '.repeat(Math.max(0, len - str.length));
  const line = (l, m, r, fill) => l + fill.repeat(maxName + 2) + m + fill.repeat(maxId + 2) + r;

  console.log('Your groups:');
  console.log(line('┌', '┬', '┐', '─'));
  console.log(`│ ${pad(nameHeader, maxName)} │ ${pad(idHeader, maxId)} │`);
  console.log(line('├', '┼', '┤', '─'));

  for (const group of groups) {
    console.log(`│ ${pad(group.name, maxName)} │ ${pad(group.id._serialized, maxId)} │`);
  }

  console.log(line('└', '┴', '┘', '─'));
  console.log('\nCopy the IDs into your .env file.\n');
}

module.exports = { createClient };
