import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { findUserByUsername, createUser } from "../repositories/user.repository";
import { JwtPayload, PublicUser, UserRole } from "../types/user.types";


const VALID_ROLES: UserRole[] = ["coordinador", "investigador_principal", "coinvestigador"];


/** Código de PostgreSQL para "violación de restricción UNIQUE". */
const UNIQUE_VIOLATION = "23505";


interface RegisterInput {
  username: string;
  password: string;
  name: string;
  role?: UserRole;
}


interface LoginInput {
  username: string;
  password: string;
}


export class AuthError extends Error {
  statusCode: number;


  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}


export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const { username, password, name, role } = input;


  if (!username || !password || !name) {
    throw new AuthError("username, password y name son obligatorios", 400);
  }


  if (role && !VALID_ROLES.includes(role)) {
    throw new AuthError(`role debe ser uno de: ${VALID_ROLES.join(", ")}`, 400);
  }


  if (await findUserByUsername(username)) {
    throw new AuthError("El usuario ya existe", 409);
  }


  const hashedPassword = await bcrypt.hash(password, 10);


  try {
    const newUser = await createUser({
      username,
      password: hashedPassword,
      name,
      role: role ?? "coinvestigador",
    });


    return {
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
    };
  } catch (error) {
    // Dos registros simultáneos con el mismo usuario: gana el primero.
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new AuthError("El usuario ya existe", 409);
    }
    throw error;
  }
}


export async function loginUser(input: LoginInput): Promise<{ token: string; user: PublicUser }> {
  const { username, password } = input;


  if (!username || !password) {
    throw new AuthError("username y password son obligatorios", 400);
  }


  const user = await findUserByUsername(username);
  if (!user) {
    throw new AuthError("Credenciales inválidas", 401);
  }


  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw new AuthError("Credenciales inválidas", 401);
  }


  const payload: JwtPayload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  };


  const token = jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });


  return {
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  };
}