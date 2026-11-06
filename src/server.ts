import http from "http";
import { Server } from "socket.io";
import { createApp } from "./app";
import { env } from "./config/env";
import { initDatabase } from "./config/database";
import { initChatSocket } from "./sockets/chat.socket";

async function bootstrap(): Promise<void> {
  await initDatabase();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: env.corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  initChatSocket(io);

  server.listen(env.port, () => {
    console.log(`InvestCol backend escuchando en http://localhost:${env.port}`);
    console.log(`Socket.io activo, canal público disponible`);
  });
}

bootstrap().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error);
  process.exit(1);
});