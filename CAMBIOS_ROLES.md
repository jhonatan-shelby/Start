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

## Sub-tarea 3: rutas publicas y promociones publicas

- Se agrego `GET /public/promotions` sin login; filtra en backend y devuelve solo promociones con `public: true`.
- Se agrego `GET /public/info` sin login; devuelve solo nombre, descripcion general, horario publico, ubicacion publica generica y mensaje de bienvenida.
- `/public/info` no expone tokens, sesiones WhatsApp, fichas/clientes, telefonos privados, conversaciones, variables de entorno ni configuracion critica.
- `PromotionService.js` normaliza promociones existentes y nuevas con `public: false` por defecto para evitar exposicion accidental.
- El endpoint administrativo `/promotions` sigue protegido y devuelve todas las promociones, publicas y privadas.
- `admin` puede cambiar `public`/`publica` e `isActive`; `manager` puede crear/editar contenido, pero no publicar ni cambiar visibilidad publica; `waitress` no gestiona promociones.
- Archivos modificados en esta fase: `server.js`, `PromotionService.js` y `CAMBIOS_ROLES.md`.
- Para probar rutas publicas: llamar `GET /public/promotions` y `GET /public/info` sin cookie de login.
- Para probar proteccion administrativa: llamar `GET /promotions` sin login y debe responder 401; iniciar sesion como `manager` e intentar enviar `public: true` o `isActive` a `POST /promotions` y debe responder 403.

## Sub-tarea 4: frontend publico, login/logout y vista por rol

- Se actualizo `public/index.html` para mostrar primero una vista publica sin login con datos de `GET /public/info` y `GET /public/promotions`.
- El visitante publico solo ve informacion general y promociones publicas; no ve clientes, fichas, sesiones WhatsApp, estadisticas internas, configuracion ni acciones administrativas.
- Se agrego formulario de login contra `POST /auth/login`; el frontend no guarda JWT en `localStorage` ni `sessionStorage`, usa la cookie httpOnly del backend.
- Tras login correcto se consulta `GET /auth/me` para cargar usuario y rol.
- Se agrego logout contra `POST /auth/logout`; al cerrar sesion se limpia el estado visual y vuelve la vista publica.
- Admin ve el panel completo: camareras, clientes/fichas, promociones administrativas, conexion WhatsApp, eliminar camareras y recap IA.
- Manager ve camareras en consulta, clientes/fichas, promociones administrativas y recap IA; no ve controles de WhatsApp ni eliminar/crear/editar camareras.
- Waitress ve solo una vista propia basica y recap propio si su usuario tiene `waitressId`; no ve clientes globales, promociones, sesiones WhatsApp ni acciones administrativas.
- Las respuestas 401 vuelven al estado no autenticado con mensaje simple; las respuestas 403 muestran permiso insuficiente sin romper la interfaz.
- La seguridad real sigue estando en backend; el frontend solo oculta controles visuales por comodidad y claridad.
- Archivo modificado en esta fase: `public/index.html` y este documento.
