import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import boardRoutes from "./routes/board.routes.js";

export const createApp = () => {
  const app = express();
app.use(cors({
  origin: "http://localhost:5175",
  credentials: true
}));
 

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/boards", boardRoutes);

  return app;
};
