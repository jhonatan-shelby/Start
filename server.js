require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createSession, getAllSessions, sendMessage, removeSession } = require('./SessionManager');
const { getFicha } = require('./AppointmentService');
const { createWaitress, loadWaitress, getAllWaitresses, deleteWaitress, saveWaitress } = require('./WaitressService');
const { loadPromotions, savePromotions, getPublicPromotions, togglePromotion } = require('./PromotionService');
const AuthService = require('./auth/AuthService');
const { requireAuth, requirePermission, requireOwnWaitressOrPermission } = require('./middleware/authMiddleware');
const { PERMISSIONS, ROLES } = require('./middleware/permissions');

if (!process.env.JWT_SECRET) {
    // Cambio agregado: el servidor no arranca sin secreto JWT configurado.
    console.error('[Auth] Error: falta JWT_SECRET en .env. Configuralo antes de iniciar el servidor.');
    process.exit(1);
}

// ─────────────────────────────────────────────
// Protección global contra crashes de Puppeteer
// ProtocolError ocurre cuando WhatsApp Web navega la página durante una evaluación.
// Es esperado y no debe detener el servidor.
// ─────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || String(reason);
    if (msg.includes('Protocol') || msg.includes('context') ||
        msg.includes('Target closed') || msg.includes('Session closed')) {
        console.warn('[Server] ⚠️  Puppeteer error ignorado (página navegando):', msg.slice(0, 80));
        return;
    }
    console.error('[Server] ❌ Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
    const msg = err?.message || String(err);
    if (msg.includes('Protocol') || msg.includes('context') ||
        msg.includes('Target closed') || msg.includes('Session closed')) {
        console.warn('[Server] ⚠️  Puppeteer crash ignorado (página navegando):', msg.slice(0, 80));
        return;
    }
    console.error('[Server] ❌ Uncaught exception:', err);
    process.exit(1); // Solo salir en errores reales
});



const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static('public'));
const PORT = 3000;

// app.use(express.json()); // Removed redundant line

// Cambio agregado: endpoints base de autenticacion con JWT en cookie httpOnly.
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y password son requeridos' });
        }

        const session = await AuthService.login(email, password);
        if (!session) {
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        res.cookie(AuthService.AUTH_COOKIE_NAME, session.token, AuthService.getCookieOptions());
        res.json({ success: true, user: session.user });
    } catch (err) {
        console.error('[Auth] Error en login:', err);
        res.status(500).json({ error: 'No se pudo iniciar sesion' });
    }
});

app.post('/auth/logout', (req, res) => {
    res.clearCookie(AuthService.AUTH_COOKIE_NAME, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    });
    res.json({ success: true });
});

app.get('/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

// Cambio agregado: rutas publicas sin login y sin datos internos del sistema.
app.get('/public/promotions', (req, res) => {
    res.json({ promotions: getPublicPromotions() });
});

app.get('/public/info', (req, res) => {
    res.json({
        name: 'Start Nightclub',
        description: 'Chatbot IA para atencion e informacion general del nightclub.',
        publicSchedule: 'Horario sujeto a programacion del nightclub.',
        publicLocation: 'Disponible por canales oficiales del negocio.',
        welcomeMessage: 'Bienvenido a Start. Consulta nuestras promociones publicas y novedades.'
    });
});

// ─────────────────────────────────────────────
// GET /sessions → Lista todas las sesiones activas
// ─────────────────────────────────────────────
app.get('/sessions', requirePermission(PERMISSIONS.WHATSAPP_SESSIONS_MANAGE), (req, res) => {
    const sessions = getAllSessions();
    res.json({ sessions });
});

// ─────────────────────────────────────────────
// POST /sessions/create → Crea una nueva sesión
// Body: { "id": "bot1" }
// ─────────────────────────────────────────────
app.post('/sessions/create', requirePermission(PERMISSIONS.WHATSAPP_SESSIONS_MANAGE), (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing "id" in body' });

    const result = createSession(id);
    if (result.error) return res.status(409).json(result);

    res.json({ message: `Session '${id}' created. Check terminal for QR code.`, ...result });
});

// ─────────────────────────────────────────────
// POST /sessions/:id/send → Enviar un mensaje
// Body: { "to": "573001234567", "message": "Hola" }
// ─────────────────────────────────────────────
app.post('/sessions/:id/send', requirePermission(PERMISSIONS.WHATSAPP_SESSIONS_MANAGE), async (req, res) => {
    const { id } = req.params;
    const { to, message } = req.body;

    if (!to || !message) return res.status(400).json({ error: 'Missing "to" or "message" in body' });

    const result = await sendMessage(id, to, message);
    if (result.error) return res.status(400).json(result);

    res.json({ success: true, ...result });
});

// ─────────────────────────────────────────────
// DELETE /sessions/:id → Desconectar y eliminar sesión
// ─────────────────────────────────────────────
app.delete('/sessions/:id', requirePermission(PERMISSIONS.WHATSAPP_SESSIONS_MANAGE), async (req, res) => {
    const { id } = req.params;
    const result = await removeSession(id);
    if (result.error) return res.status(404).json(result);

    res.json(result);
});

// ─────────────────────────────────────────────
// GET /fichas → Lista todas las fichas de clientes
// ─────────────────────────────────────────────
app.get('/fichas', requirePermission(PERMISSIONS.FICHAS_VIEW), (req, res) => {
    const fichasDir = path.join(__dirname, 'fichas');
    if (!fs.existsSync(fichasDir)) return res.json({ fichas: [] });

    const files = fs.readdirSync(fichasDir).filter(f => f.endsWith('.json'));
    const fichas = files.map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(fichasDir, f), 'utf8'));
        return { phone: data.phone, name: data.name, stage: data.stage, appointments: data.appointments.length, lastContact: data.lastContact };
    });
    res.json({ total: fichas.length, fichas });
});

// ─────────────────────────────────────────────
// GET /fichas/:phone → Ver ficha completa de un cliente
// ─────────────────────────────────────────────
app.get('/fichas/:phone', requirePermission(PERMISSIONS.FICHAS_VIEW), (req, res) => {
    const ficha = getFicha(req.params.phone);
    res.json(ficha);
});

// ─────────────────────────────────────────────
// WAITRESSES (CAMARERAS)
// ─────────────────────────────────────────────

// GET /waitresses → List all waitresses
app.get('/waitresses', requirePermission(PERMISSIONS.WAITRESSES_VIEW), (req, res) => {
    const list = getAllWaitresses();
    const sessions = getAllSessions();
    
    // Merge status from SessionManager
    const result = list.map(w => ({
        ...w,
        sessionStatus: sessions.find(s => s.id === w.id)?.status || 'offline'
    }));
    
    res.json(result);
});

// POST /waitresses → Create waitress and her WhatsApp session
app.post('/waitresses', requirePermission(PERMISSIONS.WAITRESSES_MANAGE), async (req, res) => {
    console.log('[API] 📨 POST /waitresses data received:', JSON.stringify(req.body).substring(0, 500));
    const { id, name, personality, instagram, facebook, whatsapp, schedule, imageUrl } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'Missing id or name' });

    const result = createWaitress(id, name);
    if (result.error) return res.status(400).json(result);

    // Update fields explicitly (use undefined check to allow empty strings)
    if (personality !== undefined) result.personality = personality;
    if (instagram !== undefined) result.instagram = instagram;
    if (facebook !== undefined) result.facebook = facebook;
    if (whatsapp !== undefined) result.whatsapp = whatsapp;
    if (schedule !== undefined) result.schedule = schedule;
    if (imageUrl !== undefined) result.imageUrl = imageUrl;
    
    saveWaitress(result);
    createSession(id);
    
    res.json({ success: true, waitress: result });
});

// POST /waitresses/:id/connect → Start session for existing waitress
app.post('/waitresses/:id/connect', requirePermission(PERMISSIONS.WHATSAPP_SESSIONS_MANAGE), async (req, res) => {
    const id = req.params.id;
    const waitress = loadWaitress(id);
    if (!waitress) return res.status(404).json({ error: 'Waitress not found' });

    createSession(id);
    res.json({ message: `Session '${id}' connecting...` });
});

// PUT /waitresses/:id → Update waitress profile
app.put('/waitresses/:id', requirePermission(PERMISSIONS.WAITRESSES_MANAGE), (req, res) => {
    console.log(`[API] 📝 PUT /waitresses/${req.params.id} updating...`);
    const id = req.params.id;
    const existing = loadWaitress(id);
    if (!existing) return res.status(404).json({ error: 'Waitress not found' });

    const { name, instagram, facebook, whatsapp, schedule, personality, stats, imageUrl } = req.body;
    
    if (name !== undefined) existing.name = name;
    if (instagram !== undefined) existing.instagram = instagram;
    if (facebook !== undefined) existing.facebook = facebook;
    if (whatsapp !== undefined) existing.whatsapp = whatsapp;
    if (schedule !== undefined) existing.schedule = schedule;
    if (personality !== undefined) existing.personality = personality;
    if (imageUrl !== undefined) existing.imageUrl = imageUrl;
    if (stats !== undefined) existing.stats = { ...existing.stats, ...stats };

    saveWaitress(existing);
    res.json({ success: true, waitress: existing });
});

// GET /waitresses/:id/recap → Generate AI summary of leads for this waitress
app.get('/waitresses/:id/recap', requireOwnWaitressOrPermission(PERMISSIONS.RECAP_VIEW), async (req, res) => {
    const { id } = req.params;
    console.log(`[AI] ✨ Generating Recap for ${id}...`);
    try {
        const { generateWaitressRecap } = require('./AppointmentService');
        const recap = await generateWaitressRecap(id);
        res.json({ recap });
    } catch (err) {
        console.error('[AI Error]', err);
        res.status(500).json({ error: 'Failed to generate recap' });
    }
});

// DELETE /waitresses/:id → Remove waitress and session
app.delete('/waitresses/:id', requirePermission(PERMISSIONS.WAITRESSES_MANAGE), async (req, res) => {
    const id = req.params.id;
    await removeSession(id).catch(() => {}); // Attempt to stop session
    const result = deleteWaitress(id);
    res.json(result);
});

// ─────────────────────────────────────────────
// PROMOTIONS
// ─────────────────────────────────────────────

// GET /promotions → List all promotions
app.get('/promotions', requirePermission(PERMISSIONS.PROMOTIONS_VIEW), (req, res) => {
    res.json(loadPromotions());
});

// POST /promotions/toggle → Activate/deactivate a promotion
app.post('/promotions/toggle', requirePermission(PERMISSIONS.PROMOTIONS_PUBLISH), (req, res) => {
    const { id, isActive } = req.body;
    const result = togglePromotion(id, isActive);
    res.json(result);
});

// POST /promotions → Update or add promotion
app.post('/promotions', requirePermission(PERMISSIONS.PROMOTIONS_WRITE), (req, res) => {
    const promos = loadPromotions();
    const { id, title, description, isActive } = req.body;
    const hasPublicField = Object.prototype.hasOwnProperty.call(req.body, 'public') ||
        Object.prototype.hasOwnProperty.call(req.body, 'publica');
    const publicValue = Object.prototype.hasOwnProperty.call(req.body, 'public') ? req.body.public : req.body.publica;

    if (req.user.role !== ROLES.ADMIN && (isActive !== undefined || hasPublicField)) {
        // Cambio agregado: manager puede editar contenido, pero no publicar ni cambiar visibilidad publica.
        return res.status(403).json({ error: 'Solo admin puede publicar promociones' });
    }
    
    const existing = promos.active.find(p => p.id === id);
    if (existing) {
        existing.title = title || existing.title;
        existing.description = description || existing.description;
        existing.isActive = isActive !== undefined ? isActive : existing.isActive;
        existing.public = hasPublicField ? publicValue === true : existing.public;
    } else {
        promos.active.push({
            id,
            title,
            description,
            isActive: isActive || false,
            public: req.user.role === ROLES.ADMIN && hasPublicField ? publicValue === true : false
        });
    }
    
    savePromotions(promos);
    res.json({ success: true, promos });
});

// ─────────────────────────────────────────────
// Iniciar servidor
// ─────────────────────────────────────────────
async function startServer() {
    // Cambio agregado: prepara users.json y si aplica crea el admin inicial antes de escuchar.
    await AuthService.initialize();

    app.listen(PORT, () => {
    console.log(`\n🚀 WhatsApp Session Manager running on http://localhost:${PORT}`);
    console.log(`\nEndpoints disponibles:`);
    console.log(`  POST   /auth/login              -> Iniciar sesion admin`);
    console.log(`  POST   /auth/logout             -> Cerrar sesion admin`);
    console.log(`  GET    /auth/me                 -> Ver usuario autenticado`);
    console.log(`  GET    /sessions               → Ver sesiones activas`);
    console.log(`  POST   /sessions/create         → Crear nueva sesión`);
    console.log(`  POST   /sessions/:id/send       → Enviar mensaje`);
    console.log(`  DELETE /sessions/:id            → Eliminar sesión\n`);

    });
}

startServer().catch((err) => {
    console.error('[Server] Error al iniciar:', err.message);
    process.exit(1);
});
