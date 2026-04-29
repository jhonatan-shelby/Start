const fs = require('fs');
const path = require('path');

const PROMO_FILE = path.join(__dirname, 'promotions.json');

function normalizePromotion(promo) {
    return {
        ...promo,
        // Cambio agregado: las promociones existentes quedan privadas hasta aprobacion admin.
        public: promo.public === true || promo.publica === true
    };
}

function normalizePromotions(promos) {
    return {
        active: Array.isArray(promos.active) ? promos.active.map(normalizePromotion) : [],
        history: Array.isArray(promos.history) ? promos.history.map(normalizePromotion) : []
    };
}

/**
 * Handle active promotions
 */
function loadPromotions() {
    if (!fs.existsSync(PROMO_FILE)) {
        return normalizePromotions({
            active: [
                { id: 'happyhour', title: 'Happy Hour', description: '2x1 en botellas hasta las 23:00', isActive: true, public: false },
                { id: 'blackfriday', title: 'Black Friday', description: '30% descuento en mesas VIP', isActive: false, public: false }
            ],
            history: []
        });
    }
    return normalizePromotions(JSON.parse(fs.readFileSync(PROMO_FILE, 'utf8')));
}

function savePromotions(promos) {
    fs.writeFileSync(PROMO_FILE, JSON.stringify(promos, null, 2), 'utf8');
    console.log(`[PromotionService] 📑 Promotions saved: promotions.json`);
}

function getActivePromotionTexts() {
    return loadPromotions().active
        .filter(p => p.isActive)
        .map(p => `- ${p.title}: ${p.description}`)
        .join('\n');
}

function getPublicPromotions() {
    return loadPromotions().active
        .filter(p => p.public === true)
        .map(({ id, title, description, isActive, public: isPublic }) => ({
            id,
            title,
            description,
            isActive,
            public: isPublic
        }));
}

function togglePromotion(id, isActive) {
    const promos = loadPromotions();
    const p = promos.active.find(x => x.id === id);
    if (p) {
        p.isActive = isActive;
        savePromotions(promos);
        return p;
    }
    return { error: `Promotion '${id}' not found` };
}

module.exports = { loadPromotions, savePromotions, getActivePromotionTexts, getPublicPromotions, togglePromotion };
