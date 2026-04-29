# Cambios roles y autenticacion

- Sub-tarea 1: se agrego autenticacion base con JWT en cookie httpOnly.
- Se creo AuthService, middleware de autenticacion y endpoints `/auth/login`, `/auth/logout`, `/auth/me`.
- Se agrego seed de admin desde `ADMIN_EMAIL` y `ADMIN_PASSWORD`, con usuarios locales en `data/users.json`.

## Sub-tarea 2: roles, permisos y proteccion backend

- Se agrego `middleware/permissions.js` con roles `admin`, `manager` y `waitress`, mas permisos por grupo de rutas.
- Se mejoro `middleware/authMiddleware.js` con `requireAuth`, `requireRole`, `requireAnyRole`, `requirePermission` y `requireOwnWaitressOrPermission`.
- Rutas de sesiones WhatsApp (`/sessions*`): solo `admin`.
- Fichas/clientes (`/fichas*`): `admin` y `manager`; `waitress` queda bloqueada porque no hay relacion tecnica con clientes globales.
- Camareras (`/waitresses`): ver listado solo `admin` y `manager`; crear, editar, conectar o eliminar solo `admin`.
- Recap IA (`/waitresses/:id/recap`): `admin` y `manager`; `waitress` solo si su usuario tiene `waitressId` igual al `:id`.
- Promociones administrativas: `admin` y `manager` pueden ver/editar; solo `admin` puede publicar/despublicar usando `isActive` o `/promotions/toggle`.
- Gestion futura de usuarios/roles queda preparada en permisos: solo `admin` tendra permiso para crear/modificar roles admin.
- Para probar 401: llamar un endpoint sensible, por ejemplo `GET /sessions`, sin cookie de login.
- Para probar 403: iniciar sesion como `manager` o `waitress` y llamar una ruta no permitida, por ejemplo `POST /sessions/create`.
