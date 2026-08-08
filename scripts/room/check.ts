// scripts/room/check.ts
//
// ルームサーバーの動作確認 (pnpm room:check)。
// デプロイ済み Worker に対して疎通〜認可〜リアルタイム配信〜永続化までを機械的に検証する。
// 同梱の sample-counter namespace を使用し、ルームIDは実行ごとにユニーク (状態汚染なし)。
//
// 接続先: env の REALTIME_ROOM_URL / REALTIME_ROOM_AUTH_SECRET
//   (APP_ENV で指定された環境ファイル、デフォルト .env.development。
//    直接指定も可: REALTIME_ROOM_URL=... REALTIME_ROOM_AUTH_SECRET=... pnpm room:check)
// ローカル Worker (pnpm room:dev) に対しても実行できる:
//   REALTIME_ROOM_URL=http://localhost:8787 REALTIME_ROOM_AUTH_SECRET=<.dev.varsの値> pnpm room:check
//
// 検証項目:
//   1. /version 疎通 + プロトコルバージョン一致
//   2. サーバー dispatch (直列実行・状態更新)
//   3. getState
//   4. 認可: トークン無し → 401
//   5. 認可: client トークンで HTTP dispatch → 401 (kind 不一致)
//   6. WebSocket: 接続直後の初期状態受信
//   7. WebSocket: 許可リスト内アクションの直接 dispatch
//   8. WebSocket: event effect (milestone) の配信
//   9. WebSocket: 許可リスト外アクションの拒否 (fail-closed)
//  10. WebSocket: 不正トークンの接続拒否
//  11. 永続化 (別経路 getState で状態一致)

import dotenv from "dotenv";
import { SignJWT } from "jose";

import { ROOM_PROTOCOL_VERSION } from "../../src/lib/realtimeRoom/protocol";

dotenv.config({ path: process.env.APP_ENV || ".env.development" });

const baseUrl = process.env.REALTIME_ROOM_URL?.trim().replace(/\/$/, "");
const secretRaw = process.env.REALTIME_ROOM_AUTH_SECRET?.trim();

if (!baseUrl || !secretRaw) {
  console.error(`✗ env が不足しています: REALTIME_ROOM_URL / REALTIME_ROOM_AUTH_SECRET
  例: REALTIME_ROOM_URL=https://room-server.xxx.workers.dev REALTIME_ROOM_AUTH_SECRET=... pnpm room:check`);
  process.exit(1);
}

const SECRET = new TextEncoder().encode(secretRaw);
const NS = "sample-counter";
const ROOM = `room-check-${Date.now()}`;
const wsBase = baseUrl.replace(/^http/, "ws");

const sign = (claims: Record<string, unknown>, sub?: string) => {
  let jwt = new SignJWT(claims).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime("60s");
  if (sub) jwt = jwt.setSubject(sub);
  return jwt.sign(SECRET);
};

const results: string[] = [];
const check = (name: string, cond: boolean, detail?: string) => {
  results.push(`${cond ? "✓ PASS" : "✗ FAIL"}: ${name}${cond || !detail ? "" : ` — ${detail}`}`);
};
const finish = (aborted?: string) => {
  console.log(results.join("\n"));
  if (aborted) console.error(`\n✗ 中断: ${aborted}`);
  const failed = aborted || results.some((r) => r.startsWith("✗"));
  console.log(failed ? "\n✗ room:check 失敗" : `\n✓ room:check 全 ${results.length} 項目 PASS (${baseUrl})`);
  process.exit(failed ? 1 : 0);
};

console.log(`=== realtime room: check (${baseUrl}) ===\n`);

const main = async () => {

// --- 1. /version ---
let version: { protocolVersion?: number };
try {
  const res = await fetch(`${baseUrl}/version`);
  version = (await res.json()) as { protocolVersion?: number };
} catch (error) {
  finish(`/version に接続できません (${error instanceof Error ? error.message : String(error)})`);
  throw error;
}
check(
  "1. /version 疎通 + プロトコル一致",
  version.protocolVersion === ROOM_PROTOCOL_VERSION,
  `app: v${ROOM_PROTOCOL_VERSION} / server: ${JSON.stringify(version)} — 不一致なら servers/room を再デプロイ`,
);

// --- 2. サーバー dispatch ---
const serverToken = await sign({ kind: "room_server" });
const dispatchRes = await fetch(`${baseUrl}/rooms/${NS}/${ROOM}/dispatch`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${serverToken}` },
  body: JSON.stringify({ action: { type: "increment", payload: { amount: 5 } }, userId: "check-server" }),
});
if (dispatchRes.status === 404) {
  finish(`namespace "${NS}" が Worker に登録されていません (servers/room/src/registry.ts から削除されている場合、room:check は使えません)`);
}
const dispatched = (await dispatchRes.json()) as { state?: { count?: number }; stateVersion?: number };
check("2. サーバー dispatch", dispatchRes.ok && dispatched.state?.count === 5, JSON.stringify(dispatched));

// --- 3. getState ---
const stateRes = await fetch(`${baseUrl}/rooms/${NS}/${ROOM}/state`, {
  headers: { Authorization: `Bearer ${serverToken}` },
});
const got = (await stateRes.json()) as { state?: { count?: number } };
check("3. getState", got.state?.count === 5, JSON.stringify(got));

// --- 4. 認可: トークン無し ---
const noAuth = await fetch(`${baseUrl}/rooms/${NS}/${ROOM}/dispatch`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: { type: "increment" } }),
});
check("4. トークン無し dispatch → 401", noAuth.status === 401, `status=${noAuth.status}`);

// --- 5. 認可: client トークンで HTTP dispatch ---
const clientToken = await sign({ kind: "room_client", ns: NS, roomId: ROOM }, "check-user");
const wrongKind = await fetch(`${baseUrl}/rooms/${NS}/${ROOM}/dispatch`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${clientToken}` },
  body: JSON.stringify({ action: { type: "increment" } }),
});
check("5. client トークンで HTTP dispatch → 401", wrongKind.status === 401, `status=${wrongKind.status}`);

// --- 6〜9. WebSocket ---
const ws = new WebSocket(`${wsBase}/rooms/${NS}/${ROOM}/ws?token=${encodeURIComponent(clientToken)}`);
type Msg = { type: string; event?: string; code?: string; state?: { count?: number; lastActorId?: string | null }; payload?: { count?: number } };
const messages: Msg[] = [];
try {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket 応答タイムアウト (10秒)")), 10_000);
    ws.onmessage = (ev) => {
      messages.push(JSON.parse(ev.data as string) as Msg);
      if (messages.length === 1) {
        ws.send(JSON.stringify({ v: ROOM_PROTOCOL_VERSION, type: "dispatch", action: { type: "increment", payload: { amount: 5 } } }));
      } else if (messages.length === 3) {
        ws.send(JSON.stringify({ v: ROOM_PROTOCOL_VERSION, type: "dispatch", action: { type: "reset" } }));
      } else if (messages.length === 4) {
        clearTimeout(timer);
        resolve();
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error("WebSocket 接続エラー"));
    };
  });
} catch (error) {
  finish(error instanceof Error ? error.message : String(error));
}
ws.close();

const [initial, updated, milestone, forbidden] = messages;
check("6. WS 初期状態受信", initial?.type === "state" && initial.state?.count === 5, JSON.stringify(initial));
check("7. WS クライアント dispatch (許可リスト内)", updated?.type === "state" && updated.state?.count === 10 && updated.state?.lastActorId === "check-user", JSON.stringify(updated));
check("8. WS event effect (milestone)", milestone?.type === "event" && milestone.event === "milestone" && milestone.payload?.count === 10, JSON.stringify(milestone));
check("9. WS 許可リスト外アクション拒否", forbidden?.type === "error" && forbidden.code === "action_forbidden", JSON.stringify(forbidden));

// --- 10. 不正トークン ---
const badWs = new WebSocket(`${wsBase}/rooms/${NS}/${ROOM}/ws?token=invalid`);
const badResult = await new Promise<string>((resolve) => {
  badWs.onopen = () => resolve("opened");
  badWs.onerror = () => resolve("rejected");
  setTimeout(() => resolve("timeout"), 8_000);
});
check("10. WS 不正トークン拒否", badResult === "rejected", badResult);

// --- 11. 永続化 ---
const finalRes = await fetch(`${baseUrl}/rooms/${NS}/${ROOM}/state`, {
  headers: { Authorization: `Bearer ${await sign({ kind: "room_server" })}` },
});
const final = (await finalRes.json()) as { state?: { count?: number }; stateVersion?: number };
check("11. 永続化 (count=10, version=2)", final.state?.count === 10 && final.stateVersion === 2, JSON.stringify(final));

finish();
};

main().catch((error) => {
  console.error("✗ room:check 実行エラー:", error instanceof Error ? error.message : error);
  process.exit(1);
});
