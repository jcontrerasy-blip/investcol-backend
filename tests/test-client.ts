import { io } from "socket.io-client";

const token = process.argv[2];

if (!token) {
  console.error("Debes proporcionar un token JWT como argumento.");
  console.error("Ejemplo: npx tsx tests/test-client.ts <TOKEN>");
  process.exit(1);
}

const socket = io("http://localhost:4000", {
  auth: { token },
});

socket.on("connect", () => {
  console.log("Conectado al servidor con id:", socket.id);
  socket.emit("message:send", { text: "Hola, este es un mensaje de prueba" });
});

socket.on("message:receive", (msg) => {
  console.log("[canal-publico] Nuevo mensaje:", msg);
});

socket.on("user:joined", (data) => console.log("[evento]", data.message));
socket.on("user:left", (data) => console.log("[evento]", data.message));
socket.on("users:online", (users) => console.log("Usuarios conectados:", users));

socket.on("connect_error", (err) => {
  console.error("Error de conexión:", err.message);
});