const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const AUTH_COOKIE_NAME = 'start_auth_token';
const TOKEN_EXPIRES_IN = '8h';
const TOKEN_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function ensureUsersFile() {
    if (!fs.existsSync(DATA_DIR)) {
        // Cambio agregado: crea la carpeta local de datos para usuarios en runtime.
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(USERS_FILE)) {
        // Cambio agregado: inicia el archivo privado de usuarios sin credenciales hardcodeadas.
        fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
    }
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function readUsers() {
    ensureUsersFile();

    const rawUsers = fs.readFileSync(USERS_FILE, 'utf8');
    const users = JSON.parse(rawUsers || '[]');

    if (!Array.isArray(users)) {
        throw new Error('data/users.json debe contener un arreglo de usuarios.');
    }

    return users;
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getPublicUser(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role
    };
}

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET no esta configurado en .env.');
    }
    return secret;
}

async function seedAdminUser() {
    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        console.warn('[Auth] ADMIN_EMAIL y ADMIN_PASSWORD no estan completos; no se creo admin inicial.');
        return false;
    }

    const users = readUsers();
    const existingAdmin = users.find(user => normalizeEmail(user.email) === adminEmail);
    if (existingAdmin) {
        return false;
    }

    const now = new Date().toISOString();
    users.push({
        id: `admin-${Date.now()}`,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: 'admin',
        createdAt: now,
        updatedAt: now
    });

    writeUsers(users);
    console.log(`[Auth] Usuario admin inicial creado para ${adminEmail}.`);
    return true;
}

async function initialize() {
    // Cambio agregado: valida JWT y prepara el usuario admin antes de levantar Express.
    getJwtSecret();
    ensureUsersFile();
    await seedAdminUser();
}

async function login(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const users = readUsers();
    const user = users.find(item => normalizeEmail(item.email) === normalizedEmail);

    if (!user || !await bcrypt.compare(String(password || ''), user.passwordHash)) {
        return null;
    }

    const publicUser = getPublicUser(user);
    const token = jwt.sign(publicUser, getJwtSecret(), {
        subject: user.id,
        expiresIn: TOKEN_EXPIRES_IN
    });

    return { token, user: publicUser };
}

function verifyToken(token) {
    const payload = jwt.verify(token, getJwtSecret());
    const users = readUsers();
    const user = users.find(item => item.id === payload.sub);

    if (!user) {
        return null;
    }

    return getPublicUser(user);
}

function getCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: TOKEN_MAX_AGE_MS,
        path: '/'
    };
}

module.exports = {
    AUTH_COOKIE_NAME,
    initialize,
    login,
    verifyToken,
    getCookieOptions
};
