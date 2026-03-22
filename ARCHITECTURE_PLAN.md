# 🚀 Arquitectura y Despliegue Express (Local + Túnel)

## 1. Infraestructura "Cero Costo" (Docker Local + Cloudflare/Ngrok)
Para lanzar el proyecto sin pagar servidores de inmediato, correrán **TODO el sistema en la computadora local de Windows** usando el archivo `docker-compose.yml` que ya tienen.

* **Backend (Baileys API) + PostgreSQL + Redis**: Se ejecutarán juntos en los contenedores nativos de tu computadora principal (usando Docker Desktop).
* **Túnel a Internet**: Usaremos **Cloudflare Tunnels (gratis)** o **Ngrok** para crear una URL pública segura (ej: `https://mi-api-whatsapp.ngrok-free.app`) que apunte directamente a tu puerto `3001` local sin abrir puertos en el router.
* **Colaboración Remota**: El Developer 2 (Frontend) usará esa URL pública para construir la interfaz y consumir datos desde su propia casa/computadora, tal cual lo haría con una API real en internet.

---

## 2. División del Trabajo (Modo Rápido Cero Costos)

### 🧑‍💻 Developer 1: Equipo Host y Túnel (Backend Role)
Tu objetivo es transformar tu computadora en el "servidor", manteniéndola encendida para despachar peticiones.

1. **Arrancar Docker Base**: Iniciar Docker Desktop en Windows y correr tu comando `docker compose up -d --build`. Verifica abriendo `http://localhost:3001/health` en tu navegador para ver si responde la API.
2. **Levantar el Túnel**: Descargar e iniciar un agente de red (`ngrok` o `cloudflared`). Ejecutar el comando de túnel (por ejemplo `ngrok http 3001`).
3. **Mantener y Monitorear la Red Pública**: Copiar la URL cifrada "HTTPS" que te escupe la consola del túnel y enviársela al Developer 2 (debes avisarle si tu PC se reinicia y la URL expira, en caso de no instalar una IP estática o túnel permanente).
4. **Hospedar la Producción Real**: Durante las pruebas y mientras no haya un servidor que cueste dinero de por medio, tu PC local con este túnel será el cerebro del robot en WhatsApp.

### 🧑‍💻 Developer 2: Interfaz Visual Remota (Frontend Role)
Tu objetivo es desarrollar toda la UI desde tu máquina asumiendo que el backend de tu colega es el servidor oficial.

1. **Ajuste de Endpoints y CORS**: Configura el frontend (Angular/React/Astro) para que las constantes de conexión envíen solicitudes REST (`POST/GET`) hacia la URL HTTPS generada, no a *localhost*.
2. **Pantalla 1 (Scan & Vincular WhatsApp)**: Crear la vista para conectarse a `Socket.IO` apuntado hacia esa URL externa. Escuchar el evento de socket que contiene la dupla del código QR en WebSockets y pintarlo en pantalla.
3. **Pantalla 2 (Chat Input & Histórico Básicos)**: Vista que traiga las conversaciones remotamentte de Postgre a través del puerto exportado del backend. Generar input para accionar llamadas al POST `/api/messages`.

---

## 3. Siguientes Pasos de Implementación Efectiva (Hoy Mismo)
1. **Host Action**: Inicia tu **Docker Desktop local en Windows** localizando y resolviendo el error del motor si era un problema anterior, levanta todo usando `docker compose up -d`.
2. **Network Action**: Configura Ngrok/Cloudflare Tunnel y pásale la URL al dev-2.
3. **Dev Action**: Developer 2 comienza en local el UI contra esa IP segura expuesta por Dev-1.
