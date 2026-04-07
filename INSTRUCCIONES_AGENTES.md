# Comandos para Ejecutar los Agentes 🚀

Este documento detalla los pasos y comandos necesarios para poner en marcha el sistema de agentes (camareras) de WhatsApp.

## 1. Instalación Inicial
Antes de ejecutar por primera vez, asegúrate de tener todas las dependencias instaladas:

```bash
npm install
```

## 2. Ejecutar el Servidor Principal (Backend + API)
El servidor central gestiona las sesiones de WhatsApp, la lógica de los agentes (IA Anthropic) y sirve la interfaz del panel de control.

```bash
npm run server
```

> [!NOTE]
> Una vez ejecutado, el servidor estará disponible en: **http://localhost:3000**

## 3. Flujo de Trabajo con los Agentes (Bot)

### Gestionar Camareras (Agentes)
Desde el Dashboard (http://localhost:3000), puedes:
1. **Crear una nueva Camarera**: Esto creará un perfil en la carpeta `waitresses/`.
2. **Conectar WhatsApp**: Al darle a "Connect", se generará un código QR en la terminal. Escanéalo con el teléfono que usará esa camarera.
3. **Whitelist**: El bot solo responderá a los números configurados en `SessionManager.js` dentro del array `ALLOWED_NUMBERS`.

### Comandos de Desarrollo
Si deseas probar el bot de forma aislada (sin el dashboard ni el gestor de sesiones múltiple):

```bash
npm start
```
*(Esto ejecuta `main.js`, un bot de ejemplo simple).*

## Archivos Clave
- **`.env`**: Configuración de API Keys (Anthropic).
- **`SessionManager.js`**: Configuración de la lista blanca (`ALLOWED_NUMBERS`).
- **`WaitressService.js`**: Lógica de almacenamiento de perfiles de agentes.
- **`fichas/`**: Donde se guarda el historial y perfil de cada cliente contactado.

---
*Generado automáticamente para el sistema Nightclub Management.*
