import { Request, Response } from "express";
import { registerUser, loginUser, AuthError } from "../services/auth.service";

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const user = await registerUser(req.body);
    res.status(201).json({ message: "Usuario registrado correctamente", user });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: "Error interno al registrar usuario" });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const result = await loginUser(req.body);
    res.status(200).json({ message: "Inicio de sesión exitoso", ...result });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: "Error interno al iniciar sesión" });
  }
}