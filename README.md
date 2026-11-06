# InvestCol Backend — Entrega 2

## Servidor y Comunicación Básica en Tiempo Real

Backend de InvestCol construido con **Node.js, Express, TypeScript y Socket.io**. Permite la conexión de múltiples clientes autenticados, el envío/recepción de mensajes en un canal público en tiempo real, y autenticación básica mediante JWT.

## Requisitos previos

- Node.js 18+
- npm 9+

## Instalación

```bash
npm install
```

## Configuración

Crea un archivo `.env` en la raíz con estas variables:

```env
PORT=4000
JWT_SECRET=cambia_esta_clave_por_una_segura
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

## Ejecución

```bash
npm run dev
```

El servidor queda disponible en `http://localhost:4000`.

## Arquitectura del proyecto

src/
├── app.ts # Configuración de Express
├── server.ts # Arranque del servidor HTTP + Socket.io
├── config/
│ └── env.ts # Validación de variables de entorno
├── controllers/
│ └── auth.controller.ts # Maneja request/response de auth
├── services/
│ └── auth.service.ts # Lógica de negocio de autenticación
├── middlewares/
│ └── auth.middleware.ts # Verificación de JWT
├── routes/
│ ├── auth.routes.ts # POST /api/auth/register, /login
│ └── health.routes.ts # GET /api/ping, /api/protected
├── sockets/
│ └── chat.socket.ts # Lógica de Socket.io: auth y canal público
├── types/
│ ├── env.d.ts # Tipado de variables de entorno
│ └── user.types.ts # Tipos de usuario y roles
└── utils/
└── userStore.ts # Almacén de usuarios en memoria (temporal)

> **Nota:** los usuarios se almacenan en memoria en esta entrega. La persistencia en PostgreSQL se implementará en la Entrega 4.

## Endpoints REST

| Método | Ruta | Protegida | Descripción |
|---|---|---|---|
| GET | /api/ping | No | Verifica que el servidor está en línea |
| POST | /api/auth/register | No | Registra un nuevo usuario |
| POST | /api/auth/login | No | Inicia sesión y devuelve un JWT |
| GET | /api/protected | Sí (JWT) | Valida el token y devuelve el usuario decodificado |

### Ejemplo de registro

```json
POST /api/auth/register
{
  "username": "jrestrepo",
  "password": "secreta123",
  "name": "Juan Restrepo",
  "role": "investigador_principal"
}
```

Roles válidos: `coordinador`, `investigador_principal`, `coinvestigador`.

### Ejemplo de login

```json
POST /api/auth/login
{
  "username": "jrestrepo",
  "password": "secreta123"
}
```

Devuelve un `token` que debe enviarse como `Authorization: Bearer <token>` en rutas protegidas y en la conexión de Socket.io.

## Comunicación en tiempo real (Socket.io)

Todos los clientes se autentican en el handshake con el token JWT:

```javascript
const socket = io("http://localhost:4000", { auth: { token } });
```

### Eventos del servidor al cliente

| Evento | Descripción |
|---|---|
| message:receive | Mensaje nuevo en el canal público |
| user:joined | Un usuario se conectó |
| user:left | Un usuario se desconectó |
| users:online | Lista de usuarios conectados |
| error:message | Error al procesar un mensaje inválido |

### Eventos del cliente al servidor

| Evento | Payload | Descripción |
|---|---|---|
| message:send | `{ text: string }` | Envía un mensaje al canal público |

## Pruebas de conectividad realizadas

Se validó lo siguiente durante el desarrollo:

- `GET /api/ping` responde correctamente en estado "online".
- Registro e inicio de sesión funcionan y devuelven un JWT válido.
- La ruta protegida `/api/protected` acepta tokens válidos (200) y rechaza tokens inválidos (403).
- Un cliente de prueba (`tests/test-client.ts`) se conectó exitosamente al servidor mediante Socket.io, se unió al canal público y envió/recibió mensajes en tiempo real.
- El servidor registró correctamente la conexión y desconexión del cliente en consola.

Para repetir la prueba de conectividad:

```bash
npx tsx tests/test-client.ts "<TOKEN_JWT>"
```

## Próximos pasos

- Entrega 3: cliente web en React con interfaz de chat.
- Entrega 4: persistencia en PostgreSQL, historial de mensajes, chats privados y despliegue.