// RoomDurableObject の接続トークンの期限の検査(D18: ソケットはトークンの期限を超えて生きない)。
// 実行: pnpm test:room(ルートから tsx + node:test のモジュールモック。Durable Object の state と WebSocket は偽物、トークンは本物の jose で署名)
// 見るもの: 接続できる / 期限の無い・切れたトークンは 401 / 期限後は配信せず閉じる / 期限後の操作は受けずに閉じる
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";

import { SignJWT } from "jose";

// protocol の index は `export *` だけで、ESM(servers/room)から tsx で読むとアプリ側の CJS の再 export の名前が見えない
// → 定数のファイルを直接読み、index はその値で差し替える(型は消えるので値だけでよい。Worker のビルドは wrangler が束ねるので関係しない)
import * as protocolConstants from "@/lib/realtimeRoom/protocol/constants";
import { ROOM_CLOSE_CODES, ROOM_TOKEN_KINDS } from "@/lib/realtimeRoom/protocol/constants";

import { isSocketExpired } from "./socketExpiry";

const SECRET = "test-secret-for-room";
const encoder = new TextEncoder();

/** workerd の Response(101 を返せる)と WebSocketPair の代わり */
class FakeResponse {
  readonly status: number;
  readonly webSocket: FakeSocket | undefined;
  constructor(readonly body: unknown, init?: { status?: number; webSocket?: FakeSocket }) {
    this.status = init?.status ?? 200;
    this.webSocket = init?.webSocket;
  }
}

class FakeSocket {
  attachment: unknown = null;
  sent: string[] = [];
  closed: { code: number; reason: string } | null = null;
  serializeAttachment(value: unknown) {
    this.attachment = structuredClone(value);
  }
  deserializeAttachment() {
    return this.attachment;
  }
  send(data: string) {
    if (this.closed) throw new Error("closed");
    this.sent.push(data);
  }
  close(code: number, reason: string) {
    this.closed = { code, reason };
  }
}

const accepted: FakeSocket[] = [];
const g = globalThis as Record<string, unknown>;
const realResponse = g.Response;
let RoomDurableObject: typeof import("./room").RoomDurableObject;
before(async () => {
  mock.module("@/lib/realtimeRoom/protocol", { namedExports: { ...protocolConstants } });
  g.Response = FakeResponse;
  g.WebSocketPair = class {
    0 = new FakeSocket();
    1 = new FakeSocket();
  };
  ({ RoomDurableObject } = await import("./room"));
});
after(() => {
  g.Response = realResponse;
});

const fakeState = () => {
  const store = new Map<string, unknown>();
  return {
    storage: {
      get: async (key: string | string[]) => (Array.isArray(key) ? new Map(key.filter((k) => store.has(k)).map((k) => [k, store.get(k)])) : store.get(key)),
      put: async (keyOrEntries: string | Record<string, unknown>, value?: unknown) => {
        if (typeof keyOrEntries === "string") store.set(keyOrEntries, value);
        else for (const [k, v] of Object.entries(keyOrEntries)) store.set(k, v);
      },
      delete: async (key: string) => store.delete(key),
      setAlarm: async () => {},
      deleteAlarm: async () => {},
    },
    acceptWebSocket: (ws: FakeSocket) => accepted.push(ws),
    getWebSockets: () => accepted.filter((ws) => !ws.closed),
    waitUntil: () => {},
  };
};

const newRoom = () => {
  accepted.length = 0;
  return new RoomDurableObject(fakeState() as unknown as DurableObjectState, { REALTIME_ROOM_AUTH_SECRET: SECRET } as never);
};

const sign = (claims: Record<string, unknown>, exp: string | number | null) => {
  const jwt = new SignJWT(claims).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt();
  if (exp !== null) jwt.setExpirationTime(exp);
  return jwt.sign(encoder.encode(SECRET));
};
const clientToken = (exp: string | number | null = "60s") =>
  sign({ kind: ROOM_TOKEN_KINDS.client, ns: "sample-counter", roomId: "r1", sub: "u1" }, exp);
const roomHeaders = { "x-room-ns": "sample-counter", "x-room-id": "r1" };

const connect = async (room: InstanceType<typeof RoomDurableObject>, token: string) =>
  (await room.fetch(
    new Request(`https://room.example/ws?token=${encodeURIComponent(token)}`, { headers: { ...roomHeaders, Upgrade: "websocket" } }),
  )) as unknown as FakeResponse;

const serverDispatch = async (room: InstanceType<typeof RoomDurableObject>, action: Record<string, unknown>) => {
  const token = await sign({ kind: ROOM_TOKEN_KINDS.server }, "60s");
  return room.fetch(
    new Request("https://room.example/dispatch", {
      method: "POST",
      headers: { ...roomHeaders, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
  );
};

/** Date.now を ms 進めた状態で fn を走らせる */
const later = async <T>(ms: number, fn: () => Promise<T>): Promise<T> => {
  const realNow = Date.now;
  const shifted = realNow() + ms;
  Date.now = () => shifted;
  try {
    return await fn();
  } finally {
    Date.now = realNow;
  }
};

test("接続: 期限つきのトークンで繋がり、期限を attachment に持ち、現在状態が届く", async () => {
  const room = newRoom();
  const res = await connect(room, await clientToken());
  assert.equal(res.status, 101);
  const ws = accepted[0];
  const attachment = ws.deserializeAttachment() as { userId: string; expiresAtMs: number };
  assert.equal(attachment.userId, "u1");
  assert.ok(attachment.expiresAtMs > Date.now() && attachment.expiresAtMs <= Date.now() + 61_000);
  assert.equal(JSON.parse(ws.sent[0]).type, "state");
});

test("接続: 期限の無いトークン・期限切れのトークンは 401", async () => {
  const room = newRoom();
  assert.equal((await connect(room, await clientToken(null))).status, 401);
  assert.equal((await connect(room, await clientToken(Math.floor(Date.now() / 1000) - 10))).status, 401);
  assert.equal(accepted.length, 0);
});

test("期限後の配信: 期限切れのソケットには送らずに tokenExpired で閉じ、期限内のソケットには届く", async () => {
  const room = newRoom();
  await connect(room, await clientToken("10s"));
  await connect(room, await clientToken("120s"));
  const [short, long] = accepted;
  await later(30_000, () => serverDispatch(room, { type: "increment" }));
  assert.deepEqual(short.closed, { code: ROOM_CLOSE_CODES.tokenExpired, reason: "token expired" });
  assert.equal(short.sent.length, 1, "接続時の状態のあとは何も届かない");
  assert.equal(long.closed, null);
  assert.equal(JSON.parse(long.sent.at(-1) ?? "{}").state.count, 1);
});

test("期限後の操作: 受けずに tokenExpired で閉じ、状態は変わらない。期限内なら通る", async () => {
  const room = newRoom();
  await connect(room, await clientToken("10s"));
  const ws = accepted[0];
  const message = JSON.stringify({ v: 1, type: "dispatch", action: { type: "increment" } });
  await room.webSocketMessage(ws as unknown as WebSocket, message);
  assert.equal(JSON.parse(ws.sent.at(-1) ?? "{}").state.count, 1, "期限内の許可された操作は通る");

  await later(30_000, () => room.webSocketMessage(ws as unknown as WebSocket, message));
  assert.deepEqual(ws.closed, { code: ROOM_CLOSE_CODES.tokenExpired, reason: "token expired" });
  const state = (await later(30_000, async () => {
    await connect(room, await clientToken("60s"));
    return JSON.parse(accepted.at(-1)?.sent[0] ?? "{}");
  })) as { state: { count: number } };
  assert.equal(state.state.count, 1, "期限後の操作は状態を変えない");
});

test("isSocketExpired: 期限の無い・壊れた attachment は期限切れ(fail-closed)", () => {
  assert.equal(isSocketExpired(null, 0), true);
  assert.equal(isSocketExpired({ userId: "u1" }, 0), true);
  assert.equal(isSocketExpired({ userId: "u1", expiresAtMs: 1_000 }, 999), false);
  assert.equal(isSocketExpired({ userId: "u1", expiresAtMs: 1_000 }, 1_000), true);
});
