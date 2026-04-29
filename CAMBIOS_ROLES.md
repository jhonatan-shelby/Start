# Cambios roles y autenticacion

- Sub-tarea 1: se agrego autenticacion base con JWT en cookie httpOnly.
- Se creo AuthService, middleware de autenticacion y endpoints `/auth/login`, `/auth/logout`, `/auth/me`.
- Se agrego seed de admin desde `ADMIN_EMAIL` y `ADMIN_PASSWORD`, con usuarios locales en `data/users.json`.
