const AuthService = require('../auth/AuthService');

function authMiddleware(req, res, next) {
    const token = req.cookies?.[AuthService.AUTH_COOKIE_NAME];

    if (!token) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    try {
        // Cambio agregado: expone el usuario autenticado a rutas protegidas puntuales.
        req.user = AuthService.verifyToken(token);
        if (!req.user) {
            return res.status(401).json({ error: 'Sesion invalida' });
        }

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Sesion invalida' });
    }
}

module.exports = {
    authMiddleware
};
