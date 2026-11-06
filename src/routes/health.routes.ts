import { Router, Request, Response } from "express";
import { verifyToken, AuthenticatedRequest } from "../middlewares/auth.middleware";

const router = Router();

router.get("/ping", (req: Request, res: Response) => {
  res.status(200).json({
    message: "pong",
    timestamp: new Date().toISOString(),
  });
});

router.get("/protected", verifyToken, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    message: "Acceso autorizado",
    user: req.user,
  });
});

export default router;