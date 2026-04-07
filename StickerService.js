const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

const STICKERS_DIR = path.join(__dirname, 'stickers');
if (!fs.existsSync(STICKERS_DIR)) fs.mkdirSync(STICKERS_DIR);

/**
 * Guarda un sticker recibido en el banco.
 * Llama esto cuando el bot recibe un mensaje de tipo 'sticker'.
 */
async function saveSticker(message) {
    try {
        const media = await message.downloadMedia();
        if (!media) return;

        const filename = `sticker_${Date.now()}.webp`;
        const filepath = path.join(STICKERS_DIR, filename);
        fs.writeFileSync(filepath, Buffer.from(media.data, 'base64'));
        console.log(`[StickerService] 💾 Sticker guardado: ${filename}`);
        return filename;
    } catch (err) {
        console.error('[StickerService] Error guardando sticker:', err.message);
    }
}

/**
 * Devuelve un sticker aleatorio del banco, o null si no hay ninguno.
 */
function getRandomSticker() {
    const files = fs.readdirSync(STICKERS_DIR).filter(f => f.endsWith('.webp'));
    if (files.length === 0) return null;
    const random = files[Math.floor(Math.random() * files.length)];
    return path.join(STICKERS_DIR, random);
}

/**
 * Envía un sticker aleatorio al chat.
 * Úsalo con un % de probabilidad para que no sea en cada mensaje.
 */
async function sendRandomSticker(client, chatId) {
    const stickerPath = getRandomSticker();
    if (!stickerPath) return false;

    try {
        const media = MessageMedia.fromFilePath(stickerPath);
        await client.sendMessage(chatId, media, { sendMediaAsSticker: true });
        console.log(`[StickerService] 🎭 Sticker enviado a ${chatId}`);
        return true;
    } catch (err) {
        console.error('[StickerService] Error enviando sticker:', err.message);
        return false;
    }
}

/**
 * Cuántos stickers hay en el banco
 */
function getStickerCount() {
    return fs.readdirSync(STICKERS_DIR).filter(f => f.endsWith('.webp')).length;
}

module.exports = { saveSticker, sendRandomSticker, getStickerCount };
