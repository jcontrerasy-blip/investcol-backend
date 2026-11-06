import { pool } from "../config/database";
import type { UserRole } from "../types/user.types";

/** Usuario tal como lo devuelve la base. `password` contiene el hash de bcrypt. */
export type DbUser = {
  id: string;
  username: string;
  name: string;
  password: string;
  role: UserRole;
};

/** Datos públicos de un usuario, para mostrar en la lista de personas. */
export type DirectoryUser = {
  username: string;
  name: string;
  role: UserRole;
};

interface NewUser {
  username: string;
  name: string;
  password: string;
  role: UserRole;
}

const COLUMNS = "id, username, name, password_hash AS password, role";

export async function findUserByUsername(username: string): Promise<DbUser | undefined> {
  const result = await pool.query<DbUser>(
    `SELECT ${COLUMNS} FROM users WHERE username = $1`,
    [username],
  );
  return result.rows[0];
}

export async function createUser(data: NewUser): Promise<DbUser> {
  const result = await pool.query<DbUser>(
    `INSERT INTO users (username, name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNS}`,
    [data.username, data.name, data.password, data.role],
  );
  return result.rows[0];
}

/** Todos los usuarios registrados, ordenados por nombre. */
export async function listUsers(): Promise<DirectoryUser[]> {
  const result = await pool.query<DirectoryUser>(
    "SELECT username, name, role FROM users ORDER BY name ASC",
  );
  return result.rows;
}