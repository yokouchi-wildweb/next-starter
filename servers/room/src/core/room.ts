// servers/room/src/core/room.ts
//
// ルーム権威の本体 (Durable Object)。
// 「1 ルーム = 1 インスタンス」が Cloudflare により保証され、以下を担う:
//   - 状態のインメモリ保持 + Durable Object storage への永続化 (hibernation/eviction 耐性)
//   - dispatch の直列処理 (reducer は同期純粋関数、storage 書き込み中は input gate が後続をブロック)
//   - WebSocket Hibernation API による購読者への状態ブロードキャスト
//   - effects の実行 (event ブロードキャスト / アプリ側 API への署名付き callback)
//
// 認可は fail-closed:
//   - WebSocket 接続: room_client トークン (対象 ns/roomId 一致) 必須
//   - dispatch/state (HTTP): room_server トークン必須
//   - WebSocket 経由の dispatch: RoomDefinition.clientActions 許可リストに載る action のみ

import { ROOM_PROTOCOL_VERSION, ROOM_TOKEN_KINDS, ROOM_TOKEN_QUERY_PARAM } from "@/lib/realtimeRoom/protocol";
import type {
  AnyRoomDefinition,
  RoomActionBase,
  RoomActorContext,
  RoomClientMessage,
  RoomEffect,
  RoomReducer,
  RoomServerMessage,
  RoomStateBase,
} from "@/lib/realtimeRoom/protocol";

import { roomRegistry } from "../registry";
import { extractBearerToken, isTokenForRoom, signCallbackToken, verifyRoomToken } from "./auth";
import type { Env } from "./types";

/** storage キー */
const KEY_META = "meta";
const KEY_STATE = "state";
const KEY_STATE_VERSION = "stateVersion";

type RoomMeta = { ns: string; roomId: string };

/** WebSocket ごとの attachment (hibernation を跨いで保持される) */
type SocketAttachment = { userId: string | null };

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * リクエストボディを未消費のまま応答するとコネクションが異常切断される
 * (workerd の挙動) ため、エラー早期 return の前にボディを破棄する。
 */
const discardBody = async (request: Request): Promise<void> => {
  try {
    await request.body?.cancel();
  } catch {
    // 破棄失敗は無視 (既に消費済み等)
  }
};

export class RoomDurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Env;

  private meta: RoomMeta | null = null;
  private roomState: RoomStateBase | null = null;
  private stateVersion = 0;
  private loaded = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // -------------------------------------------------------------------------
  // HTTP エントリ (entry worker から ns/roomId ヘッダ付きで転送される)
  // -------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const ns = request.headers.get("x-room-ns");
    const roomId = request.headers.get("x-room-id");

    if (!ns || !roomId || !roomRegistry[ns]) {
      await discardBody(request);
      return jsonResponse({ error: "unknown room namespace" }, 404);
    }

    await this.ensureLoaded({ ns, roomId });

    if (url.pathname.endsWith("/ws")) {
      return this.handleWebSocketUpgrade(request, ns, roomId);
    }
    if (url.pathname.endsWith("/dispatch") && request.method === "POST") {
      return this.handleServerDispatch(request);
    }
    if (url.pathname.endsWith("/state") && request.method === "GET") {
      return this.handleGetState(request);
    }
    return jsonResponse({ error: "not found" }, 404);
  }

  // -------------------------------------------------------------------------
  // WebSocket (購読 + 許可リスト制の直接 dispatch)
  // -------------------------------------------------------------------------

  private async handleWebSocketUpgrade(request: Request, ns: string, roomId: string): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return jsonResponse({ error: "expected websocket" }, 426);
    }

    const token = new URL(request.url).searchParams.get(ROOM_TOKEN_QUERY_PARAM);
    const verified = token ? await verifyRoomToken(token, this.env.REALTIME_ROOM_AUTH_SECRET) : null;
    if (!verified || verified.kind !== ROOM_TOKEN_KINDS.client || !isTokenForRoom(verified, ns, roomId)) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernation API: 接続維持中に DO がメモリから追い出されても接続は生き続ける
    this.state.acceptWebSocket(server);
    const attachment: SocketAttachment = { userId: verified.subject };
    server.serializeAttachment(attachment);

    // 接続直後に現在状態を送る (購読 = 常に最新状態が手元にある、を保証)
    server.send(JSON.stringify(this.buildStateMessage()));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureLoaded(null);
    if (!this.meta) return;

    let parsed: RoomClientMessage;
    try {
      parsed = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      this.sendError(ws, "bad_message", "メッセージを解釈できません");
      return;
    }

    if (parsed.v !== ROOM_PROTOCOL_VERSION) {
      this.sendError(ws, "protocol_mismatch", `protocol v${parsed.v} は非対応です (server: v${ROOM_PROTOCOL_VERSION})`);
      return;
    }
    if (parsed.type !== "dispatch" || !parsed.action || typeof parsed.action.type !== "string") {
      this.sendError(ws, "bad_message", "dispatch メッセージではありません");
      return;
    }

    const def = roomRegistry[this.meta.ns];
    const allowed = def?.clientActions ?? [];
    if (!def || !allowed.includes(parsed.action.type)) {
      // fail-closed: 許可リストに無い action はクライアントから実行できない
      this.sendError(ws, "action_forbidden", `action "${parsed.action.type}" はクライアントから実行できません`);
      return;
    }

    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    await this.applyAction(def, parsed.action, {
      actorType: "client",
      userId: attachment?.userId ?? null,
    });
  }

  async webSocketClose(): Promise<void> {
    // 接続数に応じた処理が必要になったら here (現状は何もしない)
  }

  // -------------------------------------------------------------------------
  // HTTP dispatch / state (Next サーバーからの呼び出し)
  // -------------------------------------------------------------------------

  private async handleServerDispatch(request: Request): Promise<Response> {
    const auth = await this.requireServerToken(request);
    if (auth) {
      await discardBody(request);
      return auth;
    }
    if (!this.meta) return jsonResponse({ error: "room not initialized" }, 500);

    const def = roomRegistry[this.meta.ns];
    if (!def) {
      await discardBody(request);
      return jsonResponse({ error: "unknown room namespace" }, 404);
    }

    let body: { action?: RoomActionBase; userId?: string | null };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }
    if (!body.action || typeof body.action.type !== "string") {
      return jsonResponse({ error: "action required" }, 400);
    }

    await this.applyAction(def, body.action, {
      actorType: "server",
      userId: typeof body.userId === "string" ? body.userId : null,
    });

    return jsonResponse({
      v: ROOM_PROTOCOL_VERSION,
      stateVersion: this.stateVersion,
      state: this.roomState,
    });
  }

  private async handleGetState(request: Request): Promise<Response> {
    const auth = await this.requireServerToken(request);
    if (auth) return auth;

    return jsonResponse({
      v: ROOM_PROTOCOL_VERSION,
      stateVersion: this.stateVersion,
      state: this.roomState,
    });
  }

  /** room_server トークンを検証。NG ならエラーレスポンス、OK なら null */
  private async requireServerToken(request: Request): Promise<Response | null> {
    const token = extractBearerToken(request);
    const verified = token ? await verifyRoomToken(token, this.env.REALTIME_ROOM_AUTH_SECRET) : null;
    if (!verified || verified.kind !== ROOM_TOKEN_KINDS.server) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // 状態管理
  // -------------------------------------------------------------------------

  /**
   * reducer 実行 → 永続化 → ブロードキャスト → effects。
   * DO のイベント処理はルーム単位で直列化されるため、reducer(同期) + storage.put の
   * 区間に別イベントが割り込むことはない (input gate)。
   */
  private async applyAction(
    def: AnyRoomDefinition,
    action: RoomActionBase,
    ctx: RoomActorContext,
  ): Promise<void> {
    if (!this.meta || this.roomState === null) return;

    // 型消去された reducer の唯一のキャスト箇所 (レジストリ登録時点で shape は保証済み)
    const reducer = def.reducer as RoomReducer<RoomStateBase, RoomActionBase>;
    let result;
    try {
      result = reducer(this.roomState, action, ctx);
    } catch (error) {
      console.error("[room reducer error]", this.meta.ns, this.meta.roomId, action.type, error);
      return;
    }

    this.roomState = result.state;
    this.stateVersion += 1;
    await this.state.storage.put({
      [KEY_STATE]: this.roomState,
      [KEY_STATE_VERSION]: this.stateVersion,
    });

    this.broadcast(this.buildStateMessage());

    for (const effect of result.effects ?? []) {
      this.runEffect(effect);
    }
  }

  private runEffect(effect: RoomEffect): void {
    if (effect.type === "event") {
      this.broadcast({
        v: ROOM_PROTOCOL_VERSION,
        type: "event",
        event: effect.event,
        payload: effect.payload,
      });
      return;
    }
    if (effect.type === "callback") {
      const base = this.env.APP_BASE_URL;
      if (!base || !this.meta) {
        console.warn("[room callback skipped] APP_BASE_URL is not configured");
        return;
      }
      const { ns, roomId } = this.meta;
      // 応答は待たない (fire-and-forget)。失敗はログのみ — 永続化の最終責任はアプリ側の設計に委ねる
      this.state.waitUntil(
        (async () => {
          const token = await signCallbackToken(this.env.REALTIME_ROOM_AUTH_SECRET, ns, roomId);
          const res = await fetch(`${base.replace(/\/$/, "")}${effect.path}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ ns, roomId, payload: effect.payload }),
          });
          if (!res.ok) {
            console.error("[room callback failed]", ns, roomId, effect.path, res.status);
          }
        })().catch((error) => {
          console.error("[room callback error]", ns, roomId, effect.path, error);
        }),
      );
    }
  }

  private broadcast(message: RoomServerMessage): void {
    const serialized = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(serialized);
      } catch {
        // 切断済みソケットへの送信失敗は無視 (close イベントで回収される)
      }
    }
  }

  private buildStateMessage(): RoomServerMessage {
    return {
      v: ROOM_PROTOCOL_VERSION,
      type: "state",
      stateVersion: this.stateVersion,
      state: this.roomState ?? {},
    };
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    ws.send(JSON.stringify({ v: ROOM_PROTOCOL_VERSION, type: "error", code, message } satisfies RoomServerMessage));
  }

  /**
   * storage からの遅延ロード (hibernation 復帰・初回アクセス両対応)。
   * requestMeta は HTTP 経由の初回のみ渡される (WebSocket 復帰時は storage の meta を使う)。
   */
  private async ensureLoaded(requestMeta: RoomMeta | null): Promise<void> {
    if (this.loaded) {
      if (requestMeta && !this.meta) this.meta = requestMeta;
      return;
    }

    const stored = await this.state.storage.get([KEY_META, KEY_STATE, KEY_STATE_VERSION]);
    const meta = (stored.get(KEY_META) as RoomMeta | undefined) ?? requestMeta ?? null;

    this.meta = meta;
    this.stateVersion = (stored.get(KEY_STATE_VERSION) as number | undefined) ?? 0;

    const storedState = stored.get(KEY_STATE) as RoomStateBase | undefined;
    if (storedState !== undefined) {
      this.roomState = storedState;
    } else if (meta && roomRegistry[meta.ns]) {
      this.roomState = roomRegistry[meta.ns].createInitialState(meta.roomId);
      await this.state.storage.put({ [KEY_META]: meta, [KEY_STATE]: this.roomState });
    }

    if (meta && stored.get(KEY_META) === undefined) {
      await this.state.storage.put(KEY_META, meta);
    }

    this.loaded = true;
  }
}
