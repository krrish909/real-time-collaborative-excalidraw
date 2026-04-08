import { Router, Request, Response } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get(
  "/:boardId/ops",
  async (req: Request<{ boardId: string }>, res: Response) => {
    const ops = await prisma.operation.findMany({
      where: {
        boardId: req.params.boardId
      },
      orderBy: {
        seq: "asc"
      }
    });

    res.json(ops.map(op => op.payload));
  }
);

export default router;
