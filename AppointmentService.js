require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { loadWaitress } = require('./WaitressService');
const { getActivePromotionTexts } = require('./PromotionService');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// Configuración — personaliza esto
// ─────────────────────────────────────────────
const CONFIG = {
    locations: ['mi oficina', 'tu lugar', 'videollamada'],
    hours: 'lunes a viernes 9am-6pm, sábados 9am-1pm',
};

const FICHAS_DIR = path.join(__dirname, 'fichas');
if (!fs.existsSync(FICHAS_DIR)) fs.mkdirSync(FICHAS_DIR);

// Historial corto de mensajes por chat (solo últimos 6 para ahorrar tokens)
const messageHistory = new Map();

// ─────────────────────────────────────────────
// Ficha: estructura completa del cliente
// ─────────────────────────────────────────────
function emptyFicha(phone) {
    return {
        phone,
        // Identidad
        name: null,
        assignedWaitressId: null, // Link a la camarera que lo atiende
        // Cita actual
        service: null,
        date: null,
        time: null,
        location: null,
        stage: 'greeting', // greeting | collecting | scheduling | confirmed
        // Perfil rico
        hobbies: [],
        routines: null,
        preferences: {},
        notes: null,
        // Historial de mensajes (últimos 5)
        lastMessages: [],
        // Historial de citas
        appointments: [],
        // Metadata
        firstContact: new Date().toISOString(),
        lastContact: null,
    };
}

function fichaPath(phone) {
    return path.join(FICHAS_DIR, `${phone}.json`);
}

function getFicha(phone) {
    const p = fichaPath(phone);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    return emptyFicha(phone);
}

function saveFicha(ficha) {
    ficha.lastContact = new Date().toISOString();
    fs.writeFileSync(fichaPath(ficha.phone), JSON.stringify(ficha, null, 2), 'utf8');
    console.log(`[AppointmentService] 💾 Ficha guardada: fichas/${ficha.phone}.json`);
}

// ─────────────────────────────────────────────
// System prompt compacto con estado embebido
// Esto evita enviar todo el historial → ahorra tokens
// ─────────────────────────────────────────────
function buildSystemPrompt(ficha, waitress) {
    // Solo enviamos campos no null para mantener el prompt pequeño
    const fichaResumen = Object.fromEntries(
        Object.entries(ficha).filter(([_, v]) =>
            v !== null && !(Array.isArray(v) && v.length === 0) && !['firstContact', 'lastContact'].includes(_)
        )
    );

    const promos = getActivePromotionTexts();
    const personality = waitress ? waitress.personality : 'Eres un asistente amigable.';
    const schedule = waitress ? waitress.schedule : CONFIG.hours;

    return `${personality} Responde en primera persona como si fueras tú mismo.
Estilo: natural, conciso, máx 2 líneas. Sin asteriscos ni markdown. Usa emojis ocasionalmente de forma natural (no en cada palabra).

Horario de disponibilidad: ${schedule}
Promociones vigentes (ofrécelas si ves interés o para cerrar la cita):
${promos || 'No hay promociones especiales hoy.'}

Ficha actual del cliente:
${JSON.stringify(fichaResumen, null, 2)}

Tu objetivo: agendar una cita extrayendo de forma natural (sin sonar a formulario):
nombre, servicio, fecha, hora, lugar, y cualquier dato extra útil (hobbies, rutinas, preferencias, notas).
Lugares: ${CONFIG.locations.join(' / ')}.
Cuando tengas cita completa confirma con un resumen breve y actualiza stage a "confirmed".

RESPONDE ÚNICAMENTE EN ESTE FORMATO JSON (sin texto extra fuera del JSON):
{
  "message": "texto corto a enviar por WhatsApp",
  "update": {
    "name": "si lo mencionó",
    "service": "si lo mencionó",
    "date": "YYYY-MM-DD si la hay",
    "time": "HH:MM si la hay",
    "location": "si la acordaron",
    "hobbies": ["si mencionó algo"],
    "routines": "si mencionó rutina",
    "preferences": {"clave": "valor si aplica"},
    "notes": "cualquier dato extra relevante",
    "stage": "nuevo stage si cambió"
  }
}
Solo incluye en "update" los campos que hayas detectado en este mensaje. Omite los demás.`;
}

// ─────────────────────────────────────────────
// Procesar mensaje entrante
// ─────────────────────────────────────────────
async function processMessage(chatId, userMessage, sessionId) {
    if (!userMessage || userMessage.trim() === '') return null;

    const phoneNumber = chatId.replace('@c.us', '');
    const ficha = getFicha(phoneNumber);
    const waitress = loadWaitress(sessionId);

    // Historial corto — solo últimos 6 mensajes (3 pares)
    if (!messageHistory.has(chatId)) messageHistory.set(chatId, []);
    const history = messageHistory.get(chatId);
    history.push({ role: 'user', content: userMessage });
    if (history.length > 6) history.splice(0, history.length - 6);

    try {
        const response = await client.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 300,
            system: buildSystemPrompt(ficha, waitress),
            messages: history,
        });

        const raw = response.content[0].text.trim();

        let parsed;
        try {
            // Claude sometimes wraps JSON in ```json ... ```
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        } catch {
            console.warn('[AppointmentService] Claude no devolvió JSON válido, usando texto directo');
            history.push({ role: 'assistant', content: raw });
            return raw;
        }

        const { message, update } = parsed;

        // Persistir historial en la ficha (máx 5)
        ficha.lastMessages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
        ficha.lastMessages.push({ role: 'assistant', content: message, timestamp: new Date().toISOString() });
        if (ficha.lastMessages.length > 5) ficha.lastMessages.splice(0, ficha.lastMessages.length - 5);

        // Actualizar ficha con datos extraídos
        if (update && Object.keys(update).length > 0) {
            Object.entries(update).forEach(([key, value]) => {
                if (value === null || value === undefined) return;
                if (key === 'preferences' && typeof value === 'object') {
                    ficha.preferences = { ...ficha.preferences, ...value };
                } else if (key === 'hobbies' && Array.isArray(value)) {
                    ficha.hobbies = [...new Set([...ficha.hobbies, ...value])];
                } else {
                    ficha[key] = value;
                }
            });

            // Si se confirmó la cita, guardarla en el historial de citas
            if (update.stage === 'confirmed') {
                ficha.appointments.push({
                    service: ficha.service,
                    date: ficha.date,
                    time: ficha.time,
                    location: ficha.location,
                    confirmedAt: new Date().toISOString(),
                });
                console.log(`[AppointmentService] 📅 Cita confirmada para ${ficha.name || phone}`);
            }

            saveFicha(ficha);
        }

        history.push({ role: 'assistant', content: message });
        return message;

    } catch (error) {
        console.error('[AppointmentService] Error:', error.message);
        return 'Disculpa, tuve un problema. ¿Me repites?';
    }
}

// ─────────────────────────────────────────────
// Obtener ficha de un contacto (para revisar)
// ─────────────────────────────────────────────
/**
 * AI RECAP: Analizar leads de una camarera
 */
async function generateWaitressRecap(waitressId) {
    if (!fs.existsSync(FICHAS_DIR)) return "No hay clientes registrados.";
    
    // 1. Obtener todos los clientes asignados
    const files = fs.readdirSync(FICHAS_DIR).filter(f => f.endsWith('.json'));
    const leads = files
        .map(f => JSON.parse(fs.readFileSync(path.join(FICHAS_DIR, f), 'utf8')))
        .filter(ficha => ficha.assignedWaitressId === waitressId || !ficha.assignedWaitressId);

    if (leads.length === 0) return "No tienes clientes asignados para analizar.";

    // 2. Resumen para Claude
    const resumeLeads = leads.map(l => ({
        nombre: l.name || l.phone,
        ultimo_mensaje: l.lastMessages.length > 0 ? l.lastMessages[l.lastMessages.length-1].content : 'Sin mensajes'
    }));

    const prompt = `Analiza estos chats para la camarera ${waitressId}. Dime quiénes son los 3 mejores clientes y qué hacer hoy. CLIENTES: ${JSON.stringify(resumeLeads)}`;

    try {
        const response = await client.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 400,
            messages: [{ role: 'user', content: prompt }],
        });
        return response.content[0].text;
    } catch (err) {
        return "Error al generar el recap con IA.";
    }
}

module.exports = { processMessage, getFicha, generateWaitressRecap };
