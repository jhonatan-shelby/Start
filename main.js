const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Create a new client instance with LocalAuth for persistent sessions
// The session will be saved in .wwebjs_auth/ folder automatically
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        // Headless mode: the browser runs in background
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Client is ready!');
});

// When the client receives QR-Code
client.on('qr', (qr) => {
    // Generate QR code in terminal
    qrcode.generate(qr, {small: true});
});

// Listening to all incoming messages
client.on('message_create', message => {
    console.log('Received message:', message.body);

    if (message.body === '!ping') {
        // reply back "pong" directly to the message
        message.reply('pong');
    }
});

// Start your client
client.initialize();
