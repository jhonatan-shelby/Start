const fs = require('fs');
const path = require('path');

const PROMO_FILE = path.join(__dirname, 'promotions.json');

/**
 * Handle active promotions
 */
function loadPromotions() {
    if (!fs.existsSync(PROMO_FILE)) {
        return {
            active: [
                { id: 'happyhour', title: 'Happy Hour', description: '2x1 en botellas hasta las 23:00', isActive: true },
                { id: 'blackfriday', title: 'Black Friday', description: '30% descuento en mesas VIP', isActive: false }
            ],
            history: []
        };
    }
    return JSON.parse(fs.readFileSync(PROMO_FILE, 'utf8'));
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

module.exports = { loadPromotions, savePromotions, getActivePromotionTexts, togglePromotion };
