import type { ClientMessage, ServerMessage } from "../types/operation";

// ─── Config ──────────────────────────────────────────────────────────────────

// e.g. VITE_WS_URL=ws://localhost:4003
const WS_BASE = import.meta.env.VITE_WS_URL ?? "ws://localhost:4003";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS  = 30_000;
const RECONNECT_FACTOR  = 2;
const HEARTBEAT_MS      = 20_000;

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

type MessageHandler = (msg: ServerMessage) => void;
type StatusHandler  = (s: ConnectionStatus) => void;

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Singleton WebSocket client.
 *
 * Backend URL contract:
 *   ws://<host>?boardId=<id>&token=<jwt>
 *
 * Backend message protocol:
 *   Client → Server : { type:"op", opType:string, payload:unknown }
 *   Server → Client : { type:"init", snapshot, lastSeq }
 *                   | { type:"op", op:{ id, boardId, actorId, type, payload, seq } }
 */
export class WebSocketService {
  private static instance: WebSocketService | null = null;

  private socket:          WebSocket | null = null;
  private boardId:         string           = "";
  private token:           string           = "";
  private status:          ConnectionStatus = "disconnected";
  private intentionalClose                  = false;
  private reconnectDelay:  number           = RECONNECT_BASE_MS;
  private reconnectTimer:  ReturnType<typeof setTimeout>  | null = null;
  private heartbeatTimer:  ReturnType<typeof setInterval> | null = null;

  /** Messages queued while socket is not OPEN. */
  private queue: ClientMessage[] = [];

  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers:  Set<StatusHandler>  = new Set();

  private constructor() {}

  static getInstance(): WebSocketService {
    WebSocketService.instance ??= new WebSocketService();
    return WebSocketService.instance;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Open a connection authenticated as `token`, joining `boardId`. */
  connect(token: string, boardId: string): void {
    this.token            = token;
    this.boardId          = boardId;
    this.intentionalClose = false;
    this.openSocket();
  }

  /** Cleanly close the connection — no reconnect will be attempted. */
  disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();
    this.socket?.close(1000, "user disconnect");
    this.socket = null;
    this.queue  = [];
    this.setStatus("disconnected");
  }

  /** Send a message; queued automatically if not yet connected. */
  send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
    }
  }

  /** Subscribe to incoming server messages. Returns an unsubscribe fn. */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /** Subscribe to connection status changes. Fires immediately with current status. */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): ConnectionStatus { return this.status; }

  // ── Internal ────────────────────────────────────────────────────────────────

  private openSocket(): void {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    this.setStatus("connecting");
    this.clearTimers();

    // Backend authenticates via URL query params
    const url = `${WS_BASE}?boardId=${encodeURIComponent(this.boardId)}&token=${encodeURIComponent(this.token)}`;

    try {
      this.socket = new WebSocket(url);
    } catch (err) {
      console.error("[WS] Failed to construct socket:", err);
      this.setStatus("error");
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      console.info("[WS] Connected to board", this.boardId);
      this.reconnectDelay = RECONNECT_BASE_MS;
      this.setStatus("connected");

      // Flush queued ops
      const queued = this.queue.splice(0);
      queued.forEach(msg => this.socket!.send(JSON.stringify(msg)));

      // Keep-alive ping (backend ignores unknown message types gracefully)
      this.heartbeatTimer = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: "ping" }));
        }
      }, HEARTBEAT_MS);
    };

    this.socket.onmessage = (ev: MessageEvent<string>) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data) as ServerMessage;
      } catch {
        console.warn("[WS] Non-JSON message ignored:", ev.data);
        return;
      }
      this.messageHandlers.forEach(h => h(msg));
    };

    this.socket.onclose = (ev) => {
      console.info(`[WS] Closed (code ${ev.code})`);
      this.clearHeartbeat();
      if (!this.intentionalClose) {
        this.setStatus("disconnected");
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = () => {
      // onerror is always followed by onclose — just update status
      this.setStatus("error");
    };
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    const delay = this.reconnectDelay;
    console.info(`[WS] Reconnecting in ${delay}ms…`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * RECONNECT_FACTOR,
        RECONNECT_MAX_MS,
      );
      this.openSocket();
    }, delay);
  }

  private setStatus(s: ConnectionStatus): void {
    this.status = s;
    this.statusHandlers.forEach(h => h(s));
  }

  private clearTimers(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer);   this.reconnectTimer = null; }
    this.clearHeartbeat();
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }
}
