const ROLES = Object.freeze({
    ADMIN: 'admin',
    MANAGER: 'manager',
    WAITRESS: 'waitress'
});

const PERMISSIONS = Object.freeze({
    WHATSAPP_SESSIONS_MANAGE: 'whatsapp:sessions:manage',
    FICHAS_VIEW: 'fichas:view',
    WAITRESSES_VIEW: 'waitresses:view',
    WAITRESSES_MANAGE: 'waitresses:manage',
    PROMOTIONS_VIEW: 'promotions:view',
    PROMOTIONS_WRITE: 'promotions:write',
    PROMOTIONS_PUBLISH: 'promotions:publish',
    RECAP_VIEW: 'recap:view',
    USERS_MANAGE: 'users:manage',
    USERS_ADMIN_ROLE_MANAGE: 'users:admin-role:manage',
    CONFIG_SENSITIVE_VIEW: 'config:sensitive:view'
});

const ROLE_PERMISSIONS = Object.freeze({
    // Cambio agregado: admin conserva acceso total, incluida gestion futura de roles admin.
    [ROLES.ADMIN]: Object.values(PERMISSIONS),
    [ROLES.MANAGER]: [
        PERMISSIONS.FICHAS_VIEW,
        PERMISSIONS.WAITRESSES_VIEW,
        PERMISSIONS.PROMOTIONS_VIEW,
        PERMISSIONS.PROMOTIONS_WRITE,
        PERMISSIONS.RECAP_VIEW
    ],
    [ROLES.WAITRESS]: []
});

function hasPermission(role, permission) {
    return Boolean(ROLE_PERMISSIONS[role]?.includes(permission));
}

function getWaitressIdForUser(user) {
    return user?.waitressId || user?.waitress_id || null;
}

function canAccessOwnWaitress(user, waitressId) {
    if (user?.role !== ROLES.WAITRESS || !waitressId) {
        return false;
    }

    // Cambio agregado: solo permite acceso propio si existe relacion tecnica explicita.
    return getWaitressIdForUser(user) === waitressId;
}

function canManageAdminRole(actorRole) {
    return hasPermission(actorRole, PERMISSIONS.USERS_ADMIN_ROLE_MANAGE);
}

module.exports = {
    ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    hasPermission,
    getWaitressIdForUser,
    canAccessOwnWaitress,
    canManageAdminRole
};
