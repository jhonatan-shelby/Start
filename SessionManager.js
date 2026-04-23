const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { processMessage } = require('./AppointmentService');
const { saveSticker, sendRandomSticker, getStickerCount } = require('./StickerService');
const { sendWaitressPhoto, getPhotoCount } = require('./PhotoService');

// ─────────────────────────────────────────────
// Whitelist — solo estos números recibirán respuesta del bot
// Formato: código de país + número sin espacios ni + ni guiones
// ─────────────────────────────────────────────
const ALLOWED_NUMBERS = [
    '593993525105', // john_cortes Stiven
    '593979378260', // Naye🖤
    '593962330960', // Juan Diego
    '593959170729',
    '593967451651',
    '281101834698926@lid',
];

// ─────────────────────────────────────────────
// Pon TEST_MODE = true para que el bot responda a CUALQUIER número
// (útil para probar sin editar la whitelist)
// ─────────────────────────────────────────────
const TEST_MODE = true;


// Map to store all active sessions: { sessionId -> { client, status, qr } }
const sessions = new Map();

// ─────────────────────────────────────────────
// Debounce buffer: acumula mensajes del mismo chat antes de responder
// { "sessionId:chatId" -> { messages: [], timer, lastMsg, session } }
// ─────────────────────────────────────────────
const pendingMessages = new Map();
const DEBOUNCE_MS = 3000; // espera 3s por si llegan más mensajes seguidos

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

    // Incoming messages → debounce y respond con IA
    client.on('message_create', async (message) => {
        // Ignore messages sent by the bot itself
        if (message.fromMe) return;

        // Ignore group messages, status broadcasts and newsletter channels
        if (message.from.endsWith('@g.us') || message.from === 'status@broadcast' || message.from.endsWith('@newsletter')) return;

        // Extract phone number (remove @c.us suffix)
        const phoneNumber = message.from.replace('@c.us', '');

        // Auto-save stickers sent by whitelisted contacts
        if (message.type === 'sticker' && ALLOWED_NUMBERS.includes(phoneNumber)) {
            await saveSticker(message);
            console.log(`[${sessionId}] 🎭 Sticker guardado. Banco: ${getStickerCount()} stickers`);
            return;
        }

        console.log(`[${sessionId}] 📨 ${phoneNumber}: ${message.body}`);

        // Only reply to whitelisted numbers (or everyone if TEST_MODE is on)
        if (!TEST_MODE && !ALLOWED_NUMBERS.includes(phoneNumber)) {
            console.log(`[${sessionId}] ⏭️  Skipping — ${phoneNumber} is not in whitelist`);
            return;
        }

        // ── DEBOUNCE ──────────────────────────────────────────────────────
        // Acumula mensajes del mismo chat durante DEBOUNCE_MS ms antes de responder
        const bufferKey = `${sessionId}:${message.from}`;
        const existing = pendingMessages.get(bufferKey);

        if (existing) {
            // Ya hay mensajes pendientes: cancelar el timer anterior y agregar este
            clearTimeout(existing.timer);
            if (message.body && message.body.trim()) existing.messages.push(message.body.trim());
            existing.lastMsg = message;
        } else {
            // Primer mensaje de este chat en este lote
            pendingMessages.set(bufferKey, {
                messages: message.body && message.body.trim() ? [message.body.trim()] : [],
                lastMsg: message,
                session,
                timer: null,
            });
        }

        const buffer = pendingMessages.get(bufferKey);

        // (Re)iniciar el timer de debounce
        buffer.timer = setTimeout(async () => {
            pendingMessages.delete(bufferKey);

            const bufferedMessages = buffer.messages;
            const lastMessage = buffer.lastMsg;
            const msgCount = bufferedMessages.length;

            if (msgCount === 0) return; // solo stickers/medias sin texto

            // Combinar todos los mensajes en uno solo para la IA
            const combined = bufferedMessages.join('\n');
            const MAX_PARTS = msgCount >= 2 ? 5 : 3; // más mensajes = más partes permitidas

            console.log(`[${sessionId}] ⏳ Procesando ${msgCount} mensaje(s) de ${phoneNumber}...`);

            // Simular lectura (proporcional al número de mensajes)
            await new Promise(resolve => setTimeout(resolve, 2000 + msgCount * 1000));

            try {
                const chat = await lastMessage.getChat();
                try { await chat.sendStateTyping(); } catch (_) {}

                // Simular escritura
                const typingMs = 8000 + msgCount * 1500;
                console.log(`[${sessionId}] ⌨️ Escribiendo por ${Math.round(typingMs / 1000)}s...`);
                await new Promise(resolve => setTimeout(resolve, typingMs));

                const result = await processMessage(lastMessage.from, combined, sessionId);
                if (!result) {
                    try { await chat.clearState(); } catch (_) {}
                    return;
                }

                const aiText = typeof result === 'string' ? result : result.message;
                const shouldSendPhoto = typeof result === 'object' && result.sendPhoto;
                const requestedSelfie = typeof result === 'object' && result.requestSelfie;

                if (requestedSelfie) console.log(`[${sessionId}] 🤳 IA pidió selfie al cliente`);

                // Separar en partes, respetar MAX_PARTS
                let parts = aiText.split(/[.\n]+/).map(p => p.trim()).filter(p => p.length > 0);
                if (parts.length > MAX_PARTS) {
                    const overflow = parts.splice(MAX_PARTS - 1).join('. ');
                    parts.push(overflow);
                    parts = parts.slice(0, MAX_PARTS);
                }

                console.log(`[${sessionId}] 🤖 Replying to ${phoneNumber} in ${parts.length}/${MAX_PARTS} message(s)`);

                for (const [index, part] of parts.entries()) {
                    await lastMessage.reply(part);

                    if (index < parts.length - 1) {
                        const nextPart = parts[index + 1] || '';
                        const delay = Math.min(Math.max(nextPart.length * 50, 1000), 4000);
                        try { await chat.sendStateTyping(); } catch (_) {}
                        await new Promise(r => setTimeout(r, delay));
                    }
                }

                try { await chat.clearState(); } catch (_) {}

                // Enviar foto si la IA lo decidió
                if (shouldSendPhoto) {
                    const count = getPhotoCount(sessionId);
                    if (count > 0) {
                        await new Promise(r => setTimeout(r, 1500));
                        await sendWaitressPhoto(session.client, lastMessage.from, sessionId);
                    } else {
                        console.log(`[${sessionId}] ⚠️ IA quiso enviar foto pero no hay fotos en waitresses/photos/${sessionId}/`);
                    }
                }

                // 30% sticker al final (solo si no se envió foto)
                if (!shouldSendPhoto && Math.random() < 0.3) {
                    await new Promise(r => setTimeout(r, 1000));
                    await sendRandomSticker(session.client, lastMessage.from);
                }

            } catch (err) {
                console.error(`[${sessionId}] Error replying:`, err.message);
            }
        }, DEBOUNCE_MS);
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
