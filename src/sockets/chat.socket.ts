import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { JwtPayload } from "../types/user.types";
import {
  getPrivateHistory,
  getPublicHistory,
  savePrivateMessage,
  savePublicMessage,
  type StoredMessage,
} from "../repositories/message.repository";
import {
  findUserByUsername,
  listUsers,
  type DirectoryUser,
} from "../repositories/user.repository";

export const PUBLIC_CHANNEL = "canal-publico";

const MAX_MESSAGE_LENGTH = 500;
const HISTORY_LIMIT = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sala personal de cada usuario: recibe sus mensajes privados en todas sus pestañas. */
const userRoom = (userId: string) => `user:${userId}`;

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

interface ConnectedUser {
  username: string;
  name: string;
}

const connectedUsers = new Map<string, ConnectedUser>();

/** Valida y limpia el texto de un mensaje. */
function checkText(value: unknown): { text?: string; error?: string } {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) return { error: "El mensaje debe incluir un texto válido" };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { error: `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres` };
  }

  return { text };
}

/** Envía solo a este cliente los últimos mensajes guardados del canal público. */
async function sendHistory(socket: Socket): Promise<void> {
  try {
    const history = await getPublicHistory(HISTORY_LIMIT);
    socket.emit("chat:history", history);
  } catch (error) {
    console.error("[socket] No se pudo cargar el historial:", error);
  }
}

export function initChatSocket(io: Server): void {
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error("No se proporcionó token de autenticación"));
    }

    try {
      const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;

      // Los tokens emitidos antes de usar PostgreSQL traían un id numérico.
      if (!UUID_PATTERN.test(decoded.id)) {
        return next(new Error("Token inválido o expirado"));
      }

      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error("Token inválido o expirado"));
    }
  });

  io.on("connection", async (socket: AuthenticatedSocket) => {
    if (!socket.user) return;

    const { id, username, name } = socket.user;

    socket.join(PUBLIC_CHANNEL);
    socket.join(userRoom(id));
    connectedUsers.set(socket.id, { username, name });

    console.log(`[socket] Cliente conectado: ${username} (${socket.id})`);

    // Canal público
    socket.on("message:send", async (payload: { text: string }) => {
      const { text, error } = checkText(payload?.text);
      if (error || !text) {
        socket.emit("error:message", { message: error });
        return;
      }

      try {
        const saved = await savePublicMessage(id, text);

        io.to(PUBLIC_CHANNEL).emit("message:receive", {
          id: saved.id,
          username,
          name,
          text,
          timestamp: saved.timestamp,
        });
      } catch (err) {
        console.error("[socket] No se pudo guardar el mensaje:", err);
        socket.emit("error:message", {
          message: "No se pudo enviar el mensaje. Intenta de nuevo.",
        });
      }
    });

    // Lista de todas las personas registradas
    socket.on("users:list", async (ack?: (users: DirectoryUser[]) => void) => {
      if (typeof ack !== "function") return;

      try {
        ack(await listUsers());
      } catch (err) {
        console.error("[socket] No se pudo listar los usuarios:", err);
        ack([]);
      }
    });

    // Historial de una conversación privada
    socket.on(
      "private:history",
      async (payload: { with?: string }, ack?: (messages: StoredMessage[]) => void) => {
        if (typeof ack !== "function") return;

        try {
          const other =
            typeof payload?.with === "string" ? await findUserByUsername(payload.with) : undefined;

          if (!other) {
            ack([]);
            return;
          }

          ack(await getPrivateHistory(id, other.id, HISTORY_LIMIT));
        } catch (err) {
          console.error("[socket] No se pudo cargar el historial privado:", err);
          ack([]);
        }
      },
    );

    // Mensaje privado
    socket.on("private:send", async (payload: { to?: string; text?: string }) => {
      const { text, error } = checkText(payload?.text);
      if (error || !text) {
        socket.emit("error:message", { message: error });
        return;
      }

      try {
        const recipient =
          typeof payload?.to === "string" ? await findUserByUsername(payload.to) : undefined;

        if (!recipient) {
          socket.emit("error:message", { message: "El destinatario no existe" });
          return;
        }

        if (recipient.id === id) {
          socket.emit("error:message", { message: "No puedes enviarte mensajes a ti mismo" });
          return;
        }

        const saved = await savePrivateMessage(id, recipient.id, text);

        // Lo reciben el destinatario y todas las pestañas del remitente.
        io.to(userRoom(recipient.id)).to(userRoom(id)).emit("private:receive", {
          id: saved.id,
          from: username,
          fromName: name,
          to: recipient.username,
          text,
          timestamp: saved.timestamp,
        });
      } catch (err) {
        console.error("[socket] No se pudo guardar el mensaje privado:", err);
        socket.emit("error:message", {
          message: "No se pudo enviar el mensaje. Intenta de nuevo.",
        });
      }
    });

    socket.on("disconnect", () => {
      connectedUsers.delete(socket.id);
      console.log(`[socket] Cliente desconectado: ${username} (${socket.id})`);

      io.to(PUBLIC_CHANNEL).emit("user:left", {
        username,
        name,
        message: `${name} ha salido del canal público`,
        timestamp: new Date().toISOString(),
      });

      io.to(PUBLIC_CHANNEL).emit("users:online", Array.from(connectedUsers.values()));
    });

    // El historial llega antes que el aviso de entrada.
    await sendHistory(socket);

    // Si el cliente se desconectó mientras se cargaba el historial, no se anuncia su entrada.
    if (!socket.connected) return;

    io.to(PUBLIC_CHANNEL).emit("user:joined", {
      username,
      name,
      message: `${name} se ha unido al canal público`,
      timestamp: new Date().toISOString(),
    });

    io.to(PUBLIC_CHANNEL).emit("users:online", Array.from(connectedUsers.values()));
  });
}