const fs = require('fs');
const path = require('path');

const WAITRESSES_DIR = path.join(__dirname, 'waitresses');
if (!fs.existsSync(WAITRESSES_DIR)) fs.mkdirSync(WAITRESSES_DIR);

/**
 * Empty waitress profile
 * @param {string} id - Simple unique ID for the waitress (e.g. 'maría')
 */
function emptyWaitress(id, name) {
    return {
        id,
        name,
        // Social Media
        instagram: '',
        facebook: '',
        whatsapp: '',
        // Custom info/personality for this waitress
        personality: `Eres ${name}. Hablas de forma muy amable, coqueta y profesional.`,
        schedule: 'Lunes a Sábado, 19:00 - 02:00',
        imageUrl: '',
        whatsappSessionId: id, // Link to SessionManager sessionId
        stats: {
            messagesSent: 0,
            appointmentsBooked: 0,
            highProbabilityClients: 0,
        },
        isActive: true,
        createdAt: new Date().toISOString(),
    };
}

function waitressPath(id) {
    return path.join(WAITRESSES_DIR, `${id}.json`);
}

function loadWaitress(id) {
    const p = waitressPath(id);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    return null;
}

function saveWaitress(waitress) {
    fs.writeFileSync(waitressPath(waitress.id), JSON.stringify(waitress, null, 2), 'utf8');
    console.log(`[WaitressService] 💾 Waitress saved: waitresses/${waitress.id}.json`);
}

function getAllWaitresses() {
    if (!fs.existsSync(WAITRESSES_DIR)) return [];
    return fs.readdirSync(WAITRESSES_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => JSON.parse(fs.readFileSync(path.join(WAITRESSES_DIR, f), 'utf8')));
}

function createWaitress(id, name) {
    if (loadWaitress(id)) return { error: `Waitress with ID '${id}' already exists` };
    const waitress = emptyWaitress(id, name);
    saveWaitress(waitress);
    return waitress;
}

function deleteWaitress(id) {
    const p = waitressPath(id);
    if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log(`[WaitressService] 🗑️  Waitress removed: ${id}`);
        return { success: true };
    }
    return { error: `Waitress '${id}' not found` };
}

module.exports = { createWaitress, loadWaitress, saveWaitress, getAllWaitresses, deleteWaitress };
