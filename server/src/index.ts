import "dotenv/config";
import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createApp } from "./app.js";
import { prisma } from "./prisma.js";
import { pub, sub } from "./redis.js";
import { verifyToken } from "./auth.js";

const PORT = Number(process.env.PORT ?? 4003);

const app = createApp();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ── Socket registry ───────────────────────────────────────────────────────────

const socketsByBoard = new Map<string, Set<WebSocket>>();

const addSocket = (boardId: string, ws: WebSocket): void => {
  if (!socketsByBoard.has(boardId)) socketsByBoard.set(boardId, new Set());
  socketsByBoard.get(boardId)!.add(ws);
};

const removeSocket = (boardId: string, ws: WebSocket): void => {
  const set = socketsByBoard.get(boardId);
  if (!set) return;
  set.delete(ws);
  if (!set.size) socketsByBoard.delete(boardId);
};

const broadcast = (boardId: string, message: string): void => {
  const set = socketsByBoard.get(boardId);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  }
};

// ── Redis pub/sub ─────────────────────────────────────────────────────────────

sub.psubscribe("board:*", (err) => {
  if (err) console.error("Redis psubscribe error:", err.message);
  else console.log("✅ Redis subscribed to board:*");
});

sub.on("pmessage", (_pattern: string, channel: string, message: string) => {
  const boardId = channel.replace("board:", "");
  broadcast(boardId, message);
});

// ── WebSocket handler ─────────────────────────────────────────────────────────

wss.on("connection", async (ws, req) => {
  try {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "", `http://${host}`);

    const boardId = url.searchParams.get("boardId");
    const token = url.searchParams.get("token");
   
    if (!boardId || !token) {
      ws.close(1008, "Missing boardId or token");
      return;
    }

    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(token);
    } catch {
      ws.close(1008, "Invalid or expired token");
      return;
    }

    const [board, latest] = await Promise.all([
      prisma.board.findFirst({
        where: { id: boardId, ownerId: payload.userId },
        select: { id: true, snapshot: true },
      }),
      prisma.operation.aggregate({
        where: { boardId },
        _max: { seq: true },
      }),
    ]);

    if (!board) {
      ws.close(1008, "Board not found");
      return;
    }

    addSocket(boardId, ws);

    ws.send(
      JSON.stringify({
        type: "init",
        snapshot: board.snapshot ?? null,
        lastSeq: latest._max.seq ?? 0,
      })
    );

    ws.on("message", async (raw) => {
      let parsed: any;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (parsed?.type !== "op") return;

      const opType = typeof parsed.opType === "string" ? parsed.opType : "op";

      try {
        const { _max } = await prisma.operation.aggregate({
          where: { boardId },
          _max: { seq: true },
        });

        const op = await prisma.operation.create({
          data: {
            boardId,
            actorId: payload.userId,
            type: opType,
            payload: parsed.payload ?? {},
            seq: (_max.seq ?? 0) + 1,
          },
        });

        await pub.publish(`board:${boardId}`, JSON.stringify({ type: "op", op }));
      } catch (err) {
        console.error(`Op error on board ${boardId}:`, err);
      }
    });

    ws.on("close", () => removeSocket(boardId, ws));
  } catch (err) {
    console.error("WS connection error:", err);
    ws.close(1011, "Server error");
  }
});

// ── Server startup ────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});

// ── Error handling ────────────────────────────────────────────────────────────

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`   Fix: lsof -ti:${PORT} | xargs kill -9`);
    process.exit(1);
  } else {
    console.error("Server error:", err);
    process.exit(1);
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async () => {
  console.log("🛑 Shutting down gracefully...");

  server.close(async () => {
    try {
      await Promise.all([
        prisma.$disconnect(),
        pub.quit(),
        sub.quit(),
      ]);
      console.log("✅ Cleanup complete");
      process.exit(0);
    } catch (err) {
      console.error("❌ Error during shutdown:", err);
      process.exit(1);
    }
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);