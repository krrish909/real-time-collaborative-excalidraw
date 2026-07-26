import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req: Request & { userId?: string }, res: Response) => {
  const boards = await prisma.board.findMany({
    where: { ownerId: req.userId as string },
    orderBy: { createdAt: "desc" },
  });
  res.json(boards.map(b => ({ ...b, name: b.title })));
});

router.get("/:id", async (req: Request & { userId?: string }, res: Response) => {
  const board = await prisma.board.findFirst({
    where: { id: req.params.id as string, ownerId: req.userId as string },
  });
  if (!board) return res.status(404).json({ error: "Board not found" });
  res.json({ ...board, name: board.title });
});

router.post("/", async (req: Request & { userId?: string }, res: Response) => {
  const { name } = req.body as { name?: string };
  const board = await prisma.board.create({
    data: { title: name || "Untitled board", ownerId: req.userId as string },
  });
  res.json({ ...board, name: board.title });
});

router.patch("/:id", async (req: Request & { userId?: string }, res: Response) => {
  const { name } = req.body as { name?: string };
  await prisma.board.updateMany({
    where: { id: req.params.id as string, ownerId: req.userId as string },
    data: { title: name },
  });
  const board = await prisma.board.findFirst({
    where: { id: req.params.id as string },
  });
  res.json({ ...board, name: board?.title });
});

router.delete("/:id", async (req: Request & { userId?: string }, res: Response) => {
  await prisma.board.deleteMany({
    where: { id: req.params.id as string, ownerId: req.userId as string },
  });
  res.status(204).send();
});

router.get("/:boardId/ops", async (req: Request, res: Response) => {
  const ops = await prisma.operation.findMany({
    where: { boardId: req.params.boardId as string },
    orderBy: { seq: "asc" },
  });
  res.json(ops.map(op => op.payload));
});

export default router;
