const fs = require('fs');
const path = require('path');

const FICHAS_DIR = path.join(__dirname, 'fichas');
if (!fs.existsSync(FICHAS_DIR)) fs.mkdirSync(FICHAS_DIR);

const names = ['Carlos Ruiz', 'Juan Perez', 'Andres Lopez', 'Roberto Diaz', 'Miguel Angel', 'Diego Torres', 'Sebastian Mora', 'Fernando G.', 'Luis M.', 'Ricardo S.'];
const phones = ['593900000001', '593900000002', '593900000003', '593900000004', '593900000005', '593900000006', '593900000007', '593900000008', '593900000009', '593900000010'];
const stages = ['lead', 'scheduling', 'confirmed', 'lead', 'scheduling', 'confirmed', 'lead', 'lead', 'scheduling', 'confirmed'];

console.log('🌱 Seeding 10 test clients...');

for (let i = 0; i < 10; i++) {
    const phone = phones[i];
    const ficha = {
        phone,
        name: names[i],
        stage: stages[i],
        service: 'Reserva VIP',
        date: stages[i] === 'confirmed' ? '2026-04-10' : null,
        time: stages[i] === 'confirmed' ? '22:00' : null,
        location: stages[i] === 'confirmed' ? 'VIP Lounge' : null,
        hobbies: ['Música', 'Coches'],
        routines: 'Suele salir los viernes',
        preferences: { "bebida": "Whisky" },
        notes: 'Cliente de prueba generado automáticamente',
        lastMessages: [
            { role: 'user', content: 'Hola, ¿qué tal?', timestamp: new Date().toISOString() },
            { role: 'assistant', content: '¡Hola! Muy bien, ¿en qué puedo ayudarte hoy? 😊', timestamp: new Date().toISOString() }
        ],
        appointments: stages[i] === 'confirmed' ? [{ date: '2026-04-10', time: '22:00', service: 'VIP' }] : [],
        assignedWaitressId: 'maria',
        firstContact: new Date().toISOString(),
        lastContact: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(FICHAS_DIR, `${phone}.json`), JSON.stringify(ficha, null, 2), 'utf8');
}

console.log('✅ 10 clients created in /fichas/');
