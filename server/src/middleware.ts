import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./auth.js";


export const authMiddleware = (
  req: Request & { userId?: string },
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ error: "No token" });

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

