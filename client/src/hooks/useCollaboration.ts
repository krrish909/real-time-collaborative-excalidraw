import { useCallback, useEffect, useRef, useState } from "react";
import { WebSocketService, type ConnectionStatus } from "../services/websocket";
import type { Shape } from "../types/shape";
import type {
  ClientOpType,
  CreateShapePayload,
  UpdateShapePayload,
  DeleteShapePayload,
  OpPayload,
  ServerInitMessage,
  ServerOpMessage,
  ServerMessage,
} from "../types/operation";

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SendOpFn {
  createShape: (shape: Shape)   => void;
  updateShape: (shape: Shape)   => void;
  deleteShape: (shapeId: string) => void;
}

interface UseCollaborationOptions {
  boardId:  string | undefined;
  token:    string | null;

  /**
   * Called once with the board snapshot on connection.
   * Pass null if the board has no snapshot yet.
   */
  onSnapshot:     (shapes: Shape[]) => void;

  /** A remote collaborator created a shape. */
  onRemoteCreate: (shape: Shape)    => void;

  /** A remote collaborator moved/updated a shape. */
  onRemoteUpdate: (shape: Shape)    => void;

  /** A remote collaborator deleted a shape. */
  onRemoteDelete: (shapeId: string) => void;
}

interface UseCollaborationReturn {
  status:  ConnectionStatus;
  sendOp:  SendOpFn;
  /** actorId of the current user — needed to filter own echoed ops */
  myActorId: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCollaboration({
  boardId,
  token,
  onSnapshot,
  onRemoteCreate,
  onRemoteUpdate,
  onRemoteDelete,
}: UseCollaborationOptions): UseCollaborationReturn {

  const ws = WebSocketService.getInstance();

  const [status,    setStatus]    = useState<ConnectionStatus>(ws.getStatus());
  const [myActorId, setMyActorId] = useState<string | null>(null);

  // ── Stable callback refs ──────────────────────────────────────────────────
  const onSnapshotRef     = useRef(onSnapshot);
  const onRemoteCreateRef = useRef(onRemoteCreate);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  const onRemoteDeleteRef = useRef(onRemoteDelete);
  useEffect(() => { onSnapshotRef.current     = onSnapshot;     }, [onSnapshot]);
  useEffect(() => { onRemoteCreateRef.current = onRemoteCreate; }, [onRemoteCreate]);
  useEffect(() => { onRemoteUpdateRef.current = onRemoteUpdate; }, [onRemoteUpdate]);
  useEffect(() => { onRemoteDeleteRef.current = onRemoteDelete; }, [onRemoteDelete]);

  // Decode actorId from JWT once (client-side, no verification needed here)
  useEffect(() => {
    if (!token) { setMyActorId(null); return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1])) as { userId?: string };
      setMyActorId(payload.userId ?? null);
    } catch {
      setMyActorId(null);
    }
  }, [token]);

  // ── Connect / disconnect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!boardId || !token) return;
    ws.connect(token, boardId);
    return () => { ws.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, token]);

  // ── Status subscription ───────────────────────────────────────────────────
  useEffect(() => ws.onStatusChange(setStatus), []);  // eslint-disable-line

  // ── Message handler ───────────────────────────────────────────────────────
  useEffect(() => {
    // Keep a ref so the closure below always reads the latest actorId
    let currentActorId: string | null = null;
    const unsub = ws.onStatusChange(() => {}); // just to read; we re-read from state via closure

    const unsubMsg = ws.onMessage((msg: ServerMessage) => {

      // ── init: replace all shapes with snapshot ──────────────────────────
      if (msg.type === "init") {
        const { snapshot } = msg as ServerInitMessage;
        onSnapshotRef.current(snapshot ?? []);
        return;
      }

      // ── op: broadcast from any client (including ourselves) ─────────────
      if (msg.type === "op") {
        const { op } = msg as ServerOpMessage;

        // Skip ops that originated from this client — we already applied them
        // optimistically. We identify ourselves by actorId decoded from the JWT.
        if (currentActorId && op.actorId === currentActorId) return;

        const payload = op.payload as OpPayload;

        if (op.type === "shape:create") {
          const p = payload as CreateShapePayload;
          if (p.shape) onRemoteCreateRef.current(p.shape);
        } else if (op.type === "shape:update") {
          const p = payload as UpdateShapePayload;
          if (p.shape) onRemoteUpdateRef.current(p.shape);
        } else if (op.type === "shape:delete") {
          const p = payload as DeleteShapePayload;
          if (p.shapeId) onRemoteDeleteRef.current(p.shapeId);
        }
        // cursor:move ops are silently ignored (no backend cursor support yet)
      }
    });

    return () => {
      unsubMsg();
      unsub();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep currentActorId in sync inside the message handler closure
  // by storing it in a ref that the closure reads
  const actorIdRef = useRef(myActorId);
  useEffect(() => { actorIdRef.current = myActorId; }, [myActorId]);

  // ── Re-wire message handler when actorId becomes known ───────────────────
  // (The closure above captured the initial null; replace it properly.)
  useEffect(() => {
    if (!myActorId) return;

    const unsub = ws.onMessage((msg: ServerMessage) => {
      if (msg.type === "init") {
        onSnapshotRef.current((msg as ServerInitMessage).snapshot ?? []);
        return;
      }
      if (msg.type === "op") {
        const { op } = msg as ServerOpMessage;
        if (op.actorId === actorIdRef.current) return;   // echo guard

        const payload = op.payload as OpPayload;
        if (op.type === "shape:create") {
          const p = payload as CreateShapePayload;
          if (p.shape) onRemoteCreateRef.current(p.shape);
        } else if (op.type === "shape:update") {
          const p = payload as UpdateShapePayload;
          if (p.shape) onRemoteUpdateRef.current(p.shape);
        } else if (op.type === "shape:delete") {
          const p = payload as DeleteShapePayload;
          if (p.shapeId) onRemoteDeleteRef.current(p.shapeId);
        }
      }
    });

    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myActorId]);

  // ── Send helpers ──────────────────────────────────────────────────────────
  const sendOp = useCallback((opType: ClientOpType, payload: OpPayload) => {
    if (!boardId) return;
    ws.send({ type: "op", opType, payload });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const sendOpRef = useRef(sendOp);
  useEffect(() => { sendOpRef.current = sendOp; }, [sendOp]);

  const api: SendOpFn = {
    createShape: (shape)   => sendOpRef.current("shape:create", { shape }),
    updateShape: (shape)   => sendOpRef.current("shape:update", { shape }),
    deleteShape: (shapeId) => sendOpRef.current("shape:delete", { shapeId }),
  };

  return { status, sendOp: api, myActorId };
}
