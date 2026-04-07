const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { processMessage } = require('./AppointmentService');
const { saveSticker, sendRandomSticker, getStickerCount } = require('./StickerService');

// ─────────────────────────────────────────────
// Whitelist — solo estos números recibirán respuesta del bot
// Formato: código de país + número sin espacios ni + ni guiones
// ─────────────────────────────────────────────
const ALLOWED_NUMBERS = [
    '593993525105', // john_cortes Stiven
    '593979378260', // Naye🖤
    '593962330960', // Juan Diego
];

// Map to store all active sessions: { sessionId -> { client, status, qr } }
const sessions = new Map();

/**
 * Create and start a new WhatsApp session
 * @param {string} sessionId - Unique ID for this bot (e.g. 'bot1', 'empresa-ventas')
 * @returns {object} Session info
 */
function createSession(sessionId) {
    if (sessions.has(sessionId)) {
        return { error: `Session '${sessionId}' already exists` };
    }

    console.log(`\n[${sessionId}] Initializing session...`);

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    // Session object stored in the map
    const session = {
        client,
        status: 'initializing',  // initializing | qr | ready | disconnected
        qr: null,
    };

    sessions.set(sessionId, session);

    // QR received — show in terminal
    client.on('qr', (qr) => {
        console.log(`\n[${sessionId}] Scan this QR code:`);
        qrcode.generate(qr, { small: true });
        session.qr = qr;
        session.status = 'qr';
    });

    // Session ready
    client.on('ready', () => {
        console.log(`[${sessionId}] ✅ Client is ready!`);
        session.status = 'ready';
        session.qr = null;
    });

    // Session disconnected
    client.on('disconnected', (reason) => {
        console.log(`[${sessionId}] ❌ Disconnected: ${reason}`);
        session.status = 'disconnected';
    });

    // Incoming messages → respond with AI only to whitelisted numbers
    client.on('message_create', async (message) => {
        // Ignore messages sent by the bot itself
        if (message.fromMe) return;

        // Ignore group messages and status broadcasts
        if (message.from.endsWith('@g.us') || message.from === 'status@broadcast') return;

        // Extract phone number (remove @c.us suffix)
        const phoneNumber = message.from.replace('@c.us', '');

        // Auto-save stickers sent by whitelisted contacts
        if (message.type === 'sticker' && ALLOWED_NUMBERS.includes(phoneNumber)) {
            await saveSticker(message);
            console.log(`[${sessionId}] 🎭 Sticker guardado. Banco: ${getStickerCount()} stickers`);
            return;
        }

        console.log(`[${sessionId}] 📨 ${phoneNumber}: ${message.body}`);

        // Only reply to whitelisted numbers
        if (!ALLOWED_NUMBERS.includes(phoneNumber)) {
            console.log(`[${sessionId}] ⏭️  Skipping — ${phoneNumber} is not in whitelist`);
            return;
        }

        // 1. Esperar 5 segundos iniciales (silencio, como si estuviera leyendo)
        console.log(`[${sessionId}] ⏳ Pasando 5s de lectura...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            // Obtener el chat para mostrar el estado "Escribiendo..."
            const chat = await message.getChat();
            await chat.sendStateTyping();
            
            // 2. Esperar 10 segundos con el estado "Escribiendo..." (tiempo considerable)
            console.log(`[${sessionId}] ⌨️ Escribiendo por 10s...`);
            await new Promise(resolve => setTimeout(resolve, 10000));

            const aiReply = await processMessage(message.from, message.body, sessionId);
            if (!aiReply) {
                await chat.clearState();
                return;
            }

            console.log(`[${sessionId}] 🤖 Replying to ${phoneNumber}: ${aiReply}`);
            await message.reply(aiReply);
            
            // Limpiar el estado de escritura
            await chat.clearState();

            // 30% de probabilidad de enviar un sticker después del mensaje
            if (Math.random() < 0.3) {
                await new Promise(r => setTimeout(r, 1500)); // pequeña pausa antes del sticker
                await sendRandomSticker(session.client, message.from);
            }
        } catch (err) {
            console.error(`[${sessionId}] Error replying:`, err.message);
        }
    });

    client.initialize();

    return { sessionId, status: 'initializing' };
}

/**
 * Get the status of all sessions
 */
function getAllSessions() {
    const result = [];
    sessions.forEach((session, id) => {
        result.push({ id, status: session.status, qr: session.qr });
    });
    return result;
}

/**
 * Send a message from a specific session
 * @param {string} sessionId - Which bot to use
 * @param {string} to - Phone number (e.g. '573001234567')
 * @param {string} message - Text to send
 */
async function sendMessage(sessionId, to, message) {
    const session = sessions.get(sessionId);
    if (!session) return { error: `Session '${sessionId}' not found` };
    if (session.status !== 'ready') return { error: `Session '${sessionId}' is not ready (status: ${session.status})` };

    const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
    await session.client.sendMessage(chatId, message);
    return { success: true, to: chatId, message };
}

/**
 * Disconnect and remove a session
 * @param {string} sessionId
 */
async function removeSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { error: `Session '${sessionId}' not found` };

    await session.client.destroy();
    sessions.delete(sessionId);
    console.log(`[${sessionId}] 🗑️  Session removed`);
    return { success: true };
}

module.exports = { createSession, getAllSessions, sendMessage, removeSession };
