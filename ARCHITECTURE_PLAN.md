# 🚀 Arquitectura y Despliegue Express (Lo más rápido posible)

## 1. Infraestructura "Todo en Uno" (VPS Único + Docker)
Para lanzar el proyecto rápidamente y sin fricciones, correrán **TODO el sistema en un mismo servidor virtual (VPS)** usando el archivo `docker-compose.yml` que ya tienen armado. Nada de clústeres ni CD/CI complicados por ahora.

* **Backend (Baileys API)** + **PostgreSQL** + **Redis** se ejecutan juntos en contenedores.
* **Frontend** servido directamente desde el backend (o en un contenedor de Nginx simple) para que toda la app esté en un solo puerto y dominio.
* **Seguridad Express**: En lugar de configurar Nginx con certificados manuales en terminal, usarán **Cloudflare Tunnels** o **Nginx Proxy Manager**, que les da HTTPS (candadito verde) en 5 minutos con interfaz gráfica.

---

## 2. División del Trabajo (Modo Rápido)

### 🧑‍💻 Developer 1: Infraestructura y Servidor (Backend Role)
Tu único objetivo es subir el código a una IP pública y que todo levante correctamente.

1. **VPS y Docker**: Renta un servidor básico (ej. Ubuntu con 2GB-4GB de RAM). Instálale Docker y clona el repositorio del código (`git clone`).
2. **Levantar Servicios**: Configura tus contraseñas en el archivo `.env` de producción y corre `docker compose up -d --build`. ¡Listo, backend y BD corriendo!
3. **Exponer con HTTPS**: Usa **Cloudflare** (que es gratis) para apuntar tu dominio a la IP del servidor. Esto cifra tu tráfico en minutos sin tocar un archivo de Nginx.
4. **Validar Postman**: Confirma que responder a llamadas remotas enviando un mensaje vía API REST desde tu computadora hacia la IP pública.

### 🧑‍💻 Developer 2: Interfaz Visual y Conexión (Frontend Role)
Tu único objetivo es crear una pantalla mínima y funcional que se conecte con la API.

1. **Pantalla 1 (Vincular WhatsApp)**: Crea una vista que se conecte a `Socket.IO`, escuche el evento del código QR, y pinte el QR en pantalla para que el usuario pueda escanear su teléfono.
2. **Pantalla 2 (Mensajería Básica)**: Una vista que reciba eventos de nuevos mensajes (vía socket) y los ponga en pantalla. Debe tener un input de texto básico que dispare un `POST /api/messages` hacia el backend.
3. **Manejo de CORS**: Asegúrate que en local las URLs del Frontend apunten al `localhost:3001` y en producción usen el dominio de la API.
4. **Entregar Build**: Ejecuta `npm run build` en tu frontend y pásale la carpeta `dist` estática al Developer 1 para montarla en el VPS.

---

## 3. Siguientes Pasos (Hoy Mismo)
1. **Local**: Inicia tu aplicación de **Docker Desktop local en Windows**. Levanta la DB con `docker compose up -d postgres redis`.
2. **Frontend**: El Developer 2 empieza a maquetar las dos pantallas conectadas al `localhost:3001`.
3. **Servidor**: El Developer 1 consigue el VPS y replica exactamente lo que hay local pero en un entorno de la nube.
