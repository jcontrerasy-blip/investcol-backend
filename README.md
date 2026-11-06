# InvestCol Backend

**InvestCol** es el backend de la Plataforma de Gestión Colaborativa de Proyectos de Investigación del TCC, Centro Tutorial Cereté. Ofrece registro e inicio de sesión, persistencia de usuarios y mensajes, y chat en tiempo real (canal público y chats privados) para los miembros de los proyectos.

Este repositorio contiene la API REST y el servidor de Socket.io. Los mensajes públicos y privados se guardan en PostgreSQL, y los clientes autenticados pueden consultar el historial de sus conversaciones.

- **Contexto académico:** Entrega 4 — TCC, Centro Tutorial Cereté
- **Docente:** Ing. D. Galeano P.
- **Autor:** jcontrerasy-blip

## Contenido

1. [Stack tecnológico](#stack-tecnológico)
2. [Arquitectura y estructura](#arquitectura-y-estructura)
3. [Base de datos](#base-de-datos)
4. [API REST](#api-rest)
5. [Socket.io](#socketio)
6. [Seguridad y configuración](#seguridad-y-configuración)
7. [Instalación y ejecución local](#instalación-y-ejecución-local-powershell)
8. [Despliegue en Render](#despliegue-en-render)
9. [URLs en línea](#urls-en-línea)
10. [Estado del proyecto](#estado-del-proyecto)
11. [Autor y repositorio](#autor-y-repositorio)

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| Entorno y lenguaje | Node.js y TypeScript |
| API REST | Express 5 |
| Tiempo real | Socket.io 4 |
| Base de datos | PostgreSQL mediante `pg` |
| Autenticación | JWT (`jsonwebtoken`) |
| Contraseñas | `bcryptjs` |

## Arquitectura y estructura

`src/server.ts` inicializa PostgreSQL, crea el servidor HTTP y conecta Express con Socket.io. `src/app.ts` configura JSON, CORS y las rutas HTTP. La autenticación se separa en rutas, controladores, servicio y repositorio; el chat delega la lectura y escritura de mensajes en su repositorio.

```text
src/
├── app.ts                    # Configuración de Express y montaje de rutas
├── server.ts                 # Arranque de PostgreSQL, HTTP y Socket.io
├── config/
│   ├── database.ts           # Pool de PostgreSQL y creación del esquema
│   └── env.ts                # Lectura y valores predeterminados del entorno
├── controllers/
│   └── auth.controller.ts    # Respuestas HTTP de registro e inicio de sesión
├── middlewares/
│   └── auth.middleware.ts    # Validación del JWT en rutas protegidas
├── repositories/
│   ├── message.repository.ts # Persistencia e historial de mensajes
│   └── user.repository.ts    # Búsqueda, registro y listado de usuarios
├── routes/
│   ├── auth.routes.ts        # Rutas de autenticación
│   └── health.routes.ts      # Ping y ruta protegida
├── services/
│   └── auth.service.ts       # Reglas de registro e inicio de sesión
├── sockets/
│   └── chat.socket.ts        # Autenticación y eventos del chat
├── types/
│   ├── env.d.ts              # Tipos de variables de entorno
│   └── user.types.ts         # Tipos de usuario, rol y JWT
└── utils/                    # Reservado; sin módulos en uso actualmente

tests/
└── test-client.ts            # Cliente Socket.io manual para pruebas locales
```

`npm run build` compila `src/` a `dist/`, y `npm run start` ejecuta `dist/server.js`.

## Base de datos

El servidor requiere PostgreSQL y la variable `DATABASE_URL`. Al iniciar, verifica la conexión y ejecuta instrucciones `CREATE TABLE/INDEX IF NOT EXISTS` para preparar el esquema, por lo que no hace falta ejecutar migraciones manuales.

### Tabla `users`

| Columna | Tipo | Restricciones / uso |
|---|---|---|
| `id` | `UUID` | Clave primaria; valor predeterminado `gen_random_uuid()` |
| `username` | `VARCHAR(30)` | Obligatorio y único |
| `name` | `VARCHAR(100)` | Obligatorio |
| `password_hash` | `TEXT` | Obligatorio; hash de la contraseña |
| `role` | `VARCHAR(30)` | Obligatorio: `coordinador`, `investigador_principal` o `coinvestigador` |
| `created_at` | `TIMESTAMPTZ` | Obligatorio; valor predeterminado `NOW()` |

Si el registro no indica `role`, se asigna `coinvestigador`.

### Tabla `messages`

| Columna | Tipo | Restricciones / uso |
|---|---|---|
| `id` | `BIGSERIAL` | Clave primaria |
| `sender_id` | `UUID` | Obligatorio; referencia a `users.id`, con borrado en cascada |
| `recipient_id` | `UUID` | Referencia a `users.id`, con borrado en cascada; `NULL` identifica un mensaje público |
| `text` | `TEXT` | Obligatorio |
| `created_at` | `TIMESTAMPTZ` | Obligatorio; valor predeterminado `NOW()` |

Se crean índices para el historial público y para los mensajes privados entre usuarios.

## API REST

Las rutas de la API se montan bajo `/api`.

| Método y ruta | Cuerpo | Respuesta exitosa |
|---|---|---|
| `GET /` | Ninguno | `200`: `{ "message": "InvestCol API - Entrega 4", "status": "online", "environment": "<NODE_ENV>" }` |
| `GET /api/ping` | Ninguno | `200`: `{ "message": "pong", "timestamp": "<fecha ISO>" }` |
| `POST /api/auth/register` | `{ "username": "…", "password": "…", "name": "…", "role": "…" }` (`role` es opcional) | `201`: `{ "message": "Usuario registrado correctamente", "user": { "id", "username", "name", "role" } }` |
| `POST /api/auth/login` | `{ "username": "…", "password": "…" }` | `200`: `{ "message": "Inicio de sesión exitoso", "token": "…", "user": { "id", "username", "name", "role" } }` |
| `GET /api/protected` | Ninguno. Requiere `Authorization: Bearer <token>` | `200`: `{ "message": "Acceso autorizado", "user": { "id", "username", "name", "role" } }` |

### Códigos de error

| Ruta | Código | Causa |
|---|---|---|
| Registro | `400` | Faltan `username`, `password` o `name`, o el rol no es válido |
| Registro | `409` | El usuario ya existe |
| Inicio de sesión | `400` | Faltan credenciales |
| Inicio de sesión | `401` | `Credenciales inválidas` (mismo mensaje si el usuario no existe o la contraseña no coincide) |
| Ruta protegida | `401` | Falta el token |
| Ruta protegida | `403` | Token inválido o expirado |

## Socket.io

El cliente debe enviar el JWT en el handshake. Ejemplo en local:

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  auth: { token: "<JWT>" },
});
```

Una conexión sin token válido se rechaza. Los clientes autenticados se unen al canal público `canal-publico` y a una sala personal, de modo que reciben sus mensajes privados en todas sus pestañas.

### Eventos del cliente al servidor

| Evento | Payload / respuesta | Comportamiento |
|---|---|---|
| `message:send` | `{ "text": "…" }` | Guarda y publica un mensaje en el canal público. El texto se recorta y debe tener entre 1 y 500 caracteres. |
| `users:list` | Sin payload; callback con `DirectoryUser[]` | Devuelve el directorio de usuarios ordenado por nombre, con `username`, `name` y `role`. |
| `private:send` | `{ "to": "<username>", "text": "…" }` | Guarda y entrega un mensaje privado al destinatario y a las sesiones del remitente. No admite destinatarios inexistentes ni enviarse mensajes a uno mismo. |
| `private:history` | `{ "with": "<username>" }`; callback con `StoredMessage[]` | Devuelve los últimos mensajes de la conversación, en orden cronológico. Si el usuario no existe, devuelve un arreglo vacío. |

Cada mensaje del historial contiene `id`, `username`, `name`, `text` y `timestamp`.

### Eventos del servidor al cliente

| Evento | Payload / comportamiento |
|---|---|
| `chat:history` | Al conectarse, envía los últimos 50 mensajes públicos en orden cronológico (`id`, `username`, `name`, `text`, `timestamp`). |
| `message:receive` | Difunde el mensaje público guardado a todos los participantes del canal. |
| `private:receive` | Entrega el mensaje privado al destinatario y a las sesiones del remitente (`id`, `from`, `fromName`, `to`, `text`, `timestamp`). |
| `user:joined` | Anuncia en el canal público que un usuario se conectó (`username`, `name`, `message`, `timestamp`). |
| `user:left` | Anuncia que un usuario se desconectó (`username`, `name`, `message`, `timestamp`). |
| `users:online` | Envía la lista de usuarios con sesiones conectadas (`username`, `name`). |
| `error:message` | Informa errores al enviar mensajes: `{ "message": "…" }`. |

El historial público se entrega automáticamente al conectar; los últimos 50 mensajes privados se consultan bajo demanda con `private:history`. Todos los mensajes se guardan en PostgreSQL antes de emitirse.

## Seguridad y configuración

- Las contraseñas se almacenan con `bcryptjs` (**10 rondas**); la API nunca devuelve el hash.
- El inicio de sesión emite un JWT con los datos públicos del usuario y la expiración de `JWT_EXPIRES_IN`. El token se verifica en `/api/protected` y en la conexión de Socket.io.
- Usuario inexistente y contraseña incorrecta producen el mismo mensaje, **`Credenciales inválidas`**, para no revelar qué usuarios existen.
- Express y Socket.io restringen CORS al origen de `CORS_ORIGIN`.
- Las consultas usan parámetros de PostgreSQL, lo que evita la inyección SQL.

> **Importante:** en producción, `CORS_ORIGIN` debe ser el origen exacto del frontend, con protocolo y sin barra final ni ruta (por ejemplo, `https://investcol-frontend.vercel.app`). Su valor predeterminado `*` es solo un respaldo para desarrollo. Si el valor no coincide, el navegador bloquea las peticiones y la aplicación muestra "No se pudo conectar con el servidor".

### Variables de entorno

No incluyas secretos reales en el README ni en el repositorio.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL |
| `JWT_SECRET` | Sí | Secreto para firmar y verificar los JWT |
| `JWT_EXPIRES_IN` | No | Vigencia de los JWT; predeterminado `1d` |
| `NODE_ENV` | No | Entorno de ejecución; predeterminado `development` |
| `CORS_ORIGIN` | No (recomendada) | Origen permitido por Express y Socket.io; predeterminado `*` |
| `PORT` | No | Puerto HTTP; predeterminado `4000` |
| `DATABASE_SSL` | No | Si vale `true`, activa SSL con `rejectUnauthorized: false`. No es necesaria con la URL interna de Render. |

## Instalación y ejecución local (PowerShell)

1. Instala Node.js, npm y PostgreSQL.
2. Sitúate en la carpeta del proyecto:

   ```powershell
   Set-Location C:\ruta\al\proyecto\investcol-backend
   ```

3. Instala las dependencias:

   ```powershell
   npm install
   ```

4. Crea un archivo `.env` en la raíz con `DATABASE_URL`, `JWT_SECRET` y, si corresponde, las demás variables. Ejemplo (valores ficticios):

   ```dotenv
   DATABASE_URL=postgresql://usuario:contrasena@localhost:5432/investcol
   JWT_SECRET=cambia_este_valor_por_un_secreto_largo
   JWT_EXPIRES_IN=1d
   CORS_ORIGIN=http://localhost:5173
   PORT=4000
   ```

5. Inicia el servidor de desarrollo:

   ```powershell
   npm run dev
   ```

   Al iniciar, el servidor conecta con PostgreSQL y prepara las tablas.

6. Comprueba el servicio desde otra ventana de PowerShell:

   ```powershell
   Invoke-RestMethod http://localhost:4000/api/ping
   ```

Para compilar y ejecutar la versión de producción:

```powershell
npm run build
npm run start
```

Para probar Socket.io con el cliente de prueba, usa un token JWT válido:

```powershell
npx tsx tests/test-client.ts "<TOKEN_JWT>"
```

## Despliegue en Render

1. Crea una base de datos PostgreSQL en Render y copia su **Internal Database URL**.
2. Crea un **Web Service** conectado al repositorio `investcol-backend`, rama `main`.
3. Configura los comandos:

   | Campo | Valor |
   |---|---|
   | Build Command | `npm install --include=dev && npm run build` |
   | Start Command | `npm run start` |
   | Health Check Path | `/api/ping` |

4. En **Environment**, define `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV=production`, `NODE_VERSION` y `CORS_ORIGIN` (dominio exacto del frontend).
5. Guarda con **Save, rebuild, and deploy**. Los cambios en variables reinician el servicio.

La aplicación crea las tablas al arrancar. Si el log muestra "PostgreSQL conectado, tablas verificadas", el despliegue está listo.

> **Plan gratuito:** el servicio entra en reposo tras un periodo sin tráfico y la primera petición puede tardar cerca de **1 minuto** (arranque en frío). La base de datos gratuita de Render tiene una vigencia limitada.

## URLs en línea

| Servicio | URL |
|---|---|
| Backend (Render) | [https://investcol-backend.onrender.com](https://investcol-backend.onrender.com) |
| Estado del servicio | [https://investcol-backend.onrender.com/api/ping](https://investcol-backend.onrender.com/api/ping) |
| Frontend (Vercel) | [https://investcol-frontend.vercel.app](https://investcol-frontend.vercel.app) |

## Estado del proyecto

Entrega 4 completada en lo que respecta al backend:

- Persistencia de usuarios y mensajes en PostgreSQL.
- Registro e inicio de sesión con JWT y contraseñas cifradas.
- Chat público en tiempo real con historial.
- Chats privados con historial y presencia de usuarios.
- Despliegue en línea en Render, con comprobación de estado en `/api/ping`.

## Autor y repositorio

- **Autor:** jcontrerasy-blip
- **Repositorio:** [jcontrerasy-blip/investcol-backend](https://github.com/jcontrerasy-blip/investcol-backend)