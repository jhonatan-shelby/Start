const express = require('express');
const fs = require('fs');
const path = require('path');
const { createSession, getAllSessions, sendMessage, removeSession } = require('./SessionManager');
const { getFicha } = require('./AppointmentService');
const { createWaitress, loadWaitress, getAllWaitresses, deleteWaitress, saveWaitress } = require('./WaitressService');
const { loadPromotions, savePromotions, togglePromotion } = require('./PromotionService');

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
app.use(express.static('public'));
const PORT = 3000;

// app.use(express.json()); // Removed redundant line

// ─────────────────────────────────────────────
// GET /sessions → Lista todas las sesiones activas
// ─────────────────────────────────────────────
app.get('/sessions', (req, res) => {
    const sessions = getAllSessions();
    res.json({ sessions });
});

// ─────────────────────────────────────────────
// POST /sessions/create → Crea una nueva sesión
// Body: { "id": "bot1" }
// ─────────────────────────────────────────────
app.post('/sessions/create', (req, res) => {
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
app.post('/sessions/:id/send', async (req, res) => {
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
app.delete('/sessions/:id', async (req, res) => {
    const { id } = req.params;
    const result = await removeSession(id);
    if (result.error) return res.status(404).json(result);

    res.json(result);
});

// ─────────────────────────────────────────────
// GET /fichas → Lista todas las fichas de clientes
// ─────────────────────────────────────────────
app.get('/fichas', (req, res) => {
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
app.get('/fichas/:phone', (req, res) => {
    const ficha = getFicha(req.params.phone);
    res.json(ficha);
});

// ─────────────────────────────────────────────
// WAITRESSES (CAMARERAS)
// ─────────────────────────────────────────────

// GET /waitresses → List all waitresses
app.get('/waitresses', (req, res) => {
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
app.post('/waitresses', async (req, res) => {
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
app.post('/waitresses/:id/connect', async (req, res) => {
    const id = req.params.id;
    const waitress = loadWaitress(id);
    if (!waitress) return res.status(404).json({ error: 'Waitress not found' });

    createSession(id);
    res.json({ message: `Session '${id}' connecting...` });
});

// PUT /waitresses/:id → Update waitress profile
app.put('/waitresses/:id', (req, res) => {
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
app.get('/waitresses/:id/recap', async (req, res) => {
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
app.delete('/waitresses/:id', async (req, res) => {
    const id = req.params.id;
    await removeSession(id).catch(() => {}); // Attempt to stop session
    const result = deleteWaitress(id);
    res.json(result);
});

// ─────────────────────────────────────────────
// PROMOTIONS
// ─────────────────────────────────────────────

// GET /promotions → List all promotions
app.get('/promotions', (req, res) => {
    res.json(loadPromotions());
});

// POST /promotions/toggle → Activate/deactivate a promotion
app.post('/promotions/toggle', (req, res) => {
    const { id, isActive } = req.body;
    const result = togglePromotion(id, isActive);
    res.json(result);
});

// POST /promotions → Update or add promotion
app.post('/promotions', (req, res) => {
    const promos = loadPromotions();
    const { id, title, description, isActive } = req.body;
    
    const existing = promos.active.find(p => p.id === id);
    if (existing) {
        existing.title = title || existing.title;
        existing.description = description || existing.description;
        existing.isActive = isActive !== undefined ? isActive : existing.isActive;
    } else {
        promos.active.push({ id, title, description, isActive: isActive || false });
    }
    
    savePromotions(promos);
    res.json({ success: true, promos });
});

// ─────────────────────────────────────────────
// Iniciar servidor
// ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 WhatsApp Session Manager running on http://localhost:${PORT}`);
    console.log(`\nEndpoints disponibles:`);
    console.log(`  GET    /sessions               → Ver sesiones activas`);
    console.log(`  POST   /sessions/create         → Crear nueva sesión`);
    console.log(`  POST   /sessions/:id/send       → Enviar mensaje`);
    console.log(`  DELETE /sessions/:id            → Eliminar sesión\n`);
});
