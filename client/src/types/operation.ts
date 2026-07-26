import type { Shape } from "./shape";

// ─── Payloads (frontend-defined, stored verbatim by backend) ─────────────────

export interface CreateShapePayload { shape: Shape }
export interface UpdateShapePayload { shape: Shape }
export interface DeleteShapePayload { shapeId: string }
export interface CursorPayload      { x: number; y: number }   // future use

export type OpPayload =
  | CreateShapePayload
  | UpdateShapePayload
  | DeleteShapePayload
  | CursorPayload;

// ─── Client → Server ─────────────────────────────────────────────────────────
// Backend expects ONLY: { type: "op", opType: string, payload: unknown }

export type ClientOpType =
  | "shape:create"
  | "shape:update"
  | "shape:delete"
  | "cursor:move";     // stored by backend, ignored until cursor support added

export interface ClientOpMessage {
  type:    "op";
  opType:  ClientOpType;
  payload: OpPayload;
}

export type ClientMessage = ClientOpMessage;

// ─── Server → Client ─────────────────────────────────────────────────────────

/** First message after connection — snapshot + replay point. */
export interface ServerInitMessage {
  type:     "init";
  snapshot: Shape[] | null;
  lastSeq:  number;
}

/** A persisted operation broadcast to all board members. */
export interface ServerOpRecord {
  id:      string;
  boardId: string;
  actorId: string;
  type:    string;
  payload: OpPayload;
  seq:     number;
}

export interface ServerOpMessage {
  type: "op";
  op:   ServerOpRecord;
}

export type ServerMessage = ServerInitMessage | ServerOpMessage;

// ─── Client-side cursor overlay (never touches backend) ──────────────────────

export interface CollaboratorCursor {
  userId:   string;
  userName: string;
  x:        number;
  y:        number;
  lastSeen: number;
}
