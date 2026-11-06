export type UserRole = "coordinador" | "investigador_principal" | "coinvestigador";

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

export interface JwtPayload {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}