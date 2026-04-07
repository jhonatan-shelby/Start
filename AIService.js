require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// System prompt — personalidad y contexto del bot
// Modifica esto para darle la personalidad que quieras
const SYSTEM_PROMPT = `Eres un asistente de atención al cliente amigable y profesional. 
Respondes de forma natural, concisa y en el idioma en que te escriban.
Si no sabes algo, lo admites honestamente.
Evita respuestas muy largas — WhatsApp no es un blog.
No uses markdown (negritas, bullets, etc.) porque en WhatsApp no se renderiza bien.`;

// Historial de conversación por número de teléfono
// { "573001234567@c.us": [ {role, content}, ... ] }
const conversationHistory = new Map();

const MAX_HISTORY = 20; // Máximo de mensajes a recordar por chat

/**
 * Procesa un mensaje recibido y retorna la respuesta de Claude
 * @param {string} chatId - ID del chat (ej: '573001234567@c.us')
 * @param {string} userMessage - Texto del mensaje recibido
 * @returns {string} Respuesta generada por Claude
 */
async function getAIResponse(chatId, userMessage) {
    // Ignorar mensajes vacíos (stickers, imágenes sin caption, etc.)
    if (!userMessage || userMessage.trim() === '') {
        return null;
    }

    // Obtener o crear historial para este chat
    if (!conversationHistory.has(chatId)) {
        conversationHistory.set(chatId, []);
    }

    const history = conversationHistory.get(chatId);

    // Agregar mensaje del usuario al historial
    history.push({ role: 'user', content: userMessage });

    // Mantener solo los últimos MAX_HISTORY mensajes
    if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
    }

    try {
        const response = await client.messages.create({
            model: 'claude-3-haiku-20240307', // Rápido y económico
            max_tokens: 500,
            system: SYSTEM_PROMPT,
            messages: history,
        });

        const assistantMessage = response.content[0].text;

        // Guardar respuesta en el historial
        history.push({ role: 'assistant', content: assistantMessage });

        return assistantMessage;

    } catch (error) {
        console.error('[AIService] Error calling Anthropic:', error.message);
        return 'Lo siento, tuve un problema para procesar tu mensaje. Intenta de nuevo en un momento.';
    }
}

/**
 * Limpiar el historial de un chat específico
 * @param {string} chatId
 */
function clearHistory(chatId) {
    conversationHistory.delete(chatId);
    console.log(`[AIService] History cleared for ${chatId}`);
}

module.exports = { getAIResponse, clearHistory };
