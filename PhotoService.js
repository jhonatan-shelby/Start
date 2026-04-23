'use strict';

const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

const PHOTOS_BASE = path.join(__dirname, 'waitresses', 'photos');
const SUPPORTED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

// Tracking de fotos enviadas recientemente por chat para no repetir
// { "sessionId:chatId": ["foto1.jpg", "foto2.jpg"] }
const recentlySent = new Map();
const RECENT_WINDOW = 3; // No repetir las últimas N fotos enviadas

/**
 * Devuelve (y crea si no existe) la carpeta de fotos de una camarera
 * @param {string} waitressId
 * @returns {string} path absoluto
 */
function getPhotosDir(waitressId) {
    const dir = path.join(PHOTOS_BASE, waitressId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * Lista las fotos disponibles de una camarera
 * @param {string} waitressId
 * @returns {string[]} lista de nombres de archivo
 */
function listPhotos(waitressId) {
    const dir = getPhotosDir(waitressId);
    return fs.readdirSync(dir).filter(f =>
        SUPPORTED_EXTS.includes(path.extname(f).toLowerCase())
    );
}

/**
 * Elige una foto aleatoria que no haya sido enviada recientemente
 * @param {string} waitressId
 * @param {string} trackingKey - clave única para tracking por chat (ej: "maria:593993525105")
 * @returns {string|null} nombre del archivo elegido, o null si no hay fotos
 */
function pickRandomPhoto(waitressId, trackingKey) {
    const all = listPhotos(waitressId);
    if (all.length === 0) return null;

    const recent = recentlySent.get(trackingKey) || [];
    // Intentar evitar las recientes; si no hay opciones nuevas, usar todas
    let candidates = all.filter(f => !recent.includes(f));
    if (candidates.length === 0) candidates = all;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    // Actualizar tracking
    const updated = [...recent, chosen].slice(-RECENT_WINDOW);
    recentlySent.set(trackingKey, updated);

    return chosen;
}

/**
 * Envía una foto aleatoria de la camarera al cliente
 * @param {object} client - instancia de whatsapp Client
 * @param {string} chatId - destino (ej: "593993525105@c.us")
 * @param {string} waitressId - ID de la camarera
 * @returns {boolean} true si se envió, false si no hay fotos
 */
async function sendWaitressPhoto(client, chatId, waitressId) {
    const trackingKey = `${waitressId}:${chatId}`;
    const fileName = pickRandomPhoto(waitressId, trackingKey);

    if (!fileName) {
        console.log(`[PhotoService] ⚠️  No hay fotos en waitresses/photos/${waitressId}/`);
        return false;
    }

    const filePath = path.join(getPhotosDir(waitressId), fileName);

    try {
        const media = MessageMedia.fromFilePath(filePath);
        await client.sendMessage(chatId, media);
        console.log(`[PhotoService] 📸 Foto enviada a ${chatId}: ${fileName}`);
        return true;
    } catch (err) {
        console.error(`[PhotoService] Error enviando foto:`, err.message);
        return false;
    }
}

/**
 * Cuántas fotos tiene una camarera disponibles
 * @param {string} waitressId
 * @returns {number}
 */
function getPhotoCount(waitressId) {
    return listPhotos(waitressId).length;
}

module.exports = { sendWaitressPhoto, getPhotoCount, getPhotosDir, listPhotos };
