import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Falta DATABASE_URL en el archivo .env");
}

/** Conexiones reutilizables a PostgreSQL. SSL se activa con DATABASE_SSL=true (bases en la nube). */
export const pool = new Pool({
  connectionString,
  max: 10,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

// Evita que un corte de conexión de un cliente inactivo cierre todo el servidor.
pool.on("error", (error) => {
  console.error("Error inesperado en el pool de PostgreSQL:", error.message);
});

/**
 * Esquema de la base. Es idempotente: se puede ejecutar en cada arranque.
 * messages.recipient_id en NULL significa mensaje del canal público.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL
      CHECK (role IN ('coordinador', 'investigador_principal', 'coinvestigador')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_messages_public
    ON messages (created_at DESC) WHERE recipient_id IS NULL;

  CREATE INDEX IF NOT EXISTS idx_messages_private
    ON messages (sender_id, recipient_id, created_at DESC);
`;

/** Verifica la conexión y crea las tablas si no existen. */
export async function initDatabase(): Promise<void> {
  await pool.query(SCHEMA);
  console.log("PostgreSQL conectado, tablas verificadas");
}