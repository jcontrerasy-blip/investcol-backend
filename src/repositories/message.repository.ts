import { pool } from "../config/database";

/** Mensaje guardado, listo para enviarse a los clientes. */
export type StoredMessage = {
  id: string;
  username: string;
  name: string;
  text: string;
  timestamp: string;
};

type MessageRow = {
  id: string;
  username: string;
  name: string;
  text: string;
  created_at: Date;
};

function toStoredMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    text: row.text,
    timestamp: row.created_at.toISOString(),
  };
}

/** Inserta un mensaje. recipientId en null significa canal público. */
async function insertMessage(
  senderId: string,
  recipientId: string | null,
  text: string,
): Promise<{ id: string; timestamp: string }> {
  const result = await pool.query<{ id: string; created_at: Date }>(
    `INSERT INTO messages (sender_id, recipient_id, text)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [senderId, recipientId, text],
  );

  const row = result.rows[0];
  return { id: row.id, timestamp: row.created_at.toISOString() };
}

export function savePublicMessage(senderId: string, text: string) {
  return insertMessage(senderId, null, text);
}

export function savePrivateMessage(senderId: string, recipientId: string, text: string) {
  return insertMessage(senderId, recipientId, text);
}

/** Últimos mensajes del canal público, del más antiguo al más reciente. */
export async function getPublicHistory(limit: number): Promise<StoredMessage[]> {
  const result = await pool.query<MessageRow>(
    `SELECT m.id, u.username, u.name, m.text, m.created_at
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.recipient_id IS NULL
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.reverse().map(toStoredMessage);
}

/** Últimos mensajes entre dos usuarios, del más antiguo al más reciente. */
export async function getPrivateHistory(
  userId: string,
  otherId: string,
  limit: number,
): Promise<StoredMessage[]> {
  const result = await pool.query<MessageRow>(
    `SELECT m.id, u.username, u.name, m.text, m.created_at
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE (m.sender_id = $1 AND m.recipient_id = $2)
        OR (m.sender_id = $2 AND m.recipient_id = $1)
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $3`,
    [userId, otherId, limit],
  );

  return result.rows.reverse().map(toStoredMessage);
}