const AuthService = require('../auth/AuthService');
const { hasPermission, canAccessOwnWaitress } = require('./permissions');

function requireAuth(req, res, next) {
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

function requireAnyRole(roles) {
    return (req, res, next) => {
        requireAuth(req, res, () => {
            // Cambio agregado: token valido sin rol autorizado responde 403.
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ error: 'Permiso denegado' });
            }

            next();
        });
    };
}

function requireRole(role) {
    return requireAnyRole([role]);
}

function requirePermission(permission) {
    return (req, res, next) => {
        requireAuth(req, res, () => {
            // Cambio agregado: centraliza autorizacion por permiso para rutas sensibles.
            if (!hasPermission(req.user.role, permission)) {
                return res.status(403).json({ error: 'Permiso denegado' });
            }

            next();
        });
    };
}

function requireOwnWaitressOrPermission(permission) {
    return (req, res, next) => {
        requireAuth(req, res, () => {
            if (hasPermission(req.user.role, permission) || canAccessOwnWaitress(req.user, req.params.id)) {
                return next();
            }

            return res.status(403).json({ error: 'Permiso denegado' });
        });
    };
}

module.exports = {
    authMiddleware: requireAuth,
    requireAuth,
    requireRole,
    requireAnyRole,
    requirePermission,
    requireOwnWaitressOrPermission
};
