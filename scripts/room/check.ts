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
// 新規 workers.dev サブドメインは伝播に ~20 秒程度かかり、その間 Cloudflare のエラーページ
// (1042 等、非 JSON) が返る。初回デプロイ直後の実行が「失敗」に見えないよう短いバックオフで
// リトライする (上限は ROOM_CHECK_VERSION_TIMEOUT_MS で調整可、既定 60 秒)
const versionTimeoutMs = Number(process.env.ROOM_CHECK_VERSION_TIMEOUT_MS) || 60_000;
let version: { protocolVersion?: number } | null = null;
{
  const startedAt = Date.now();
  let lastError = "";
  let waitNoticeShown = false;
  while (Date.now() - startedAt < versionTimeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/version`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      version = (await res.json()) as { protocolVersion?: number };
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (!waitNoticeShown) {
        console.log("… /version 応答待ち (初回デプロイ直後は workers.dev の伝播に ~20 秒かかることがあります)");
        waitNoticeShown = true;
      }
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  if (!version) {
    finish(`/version に接続できません (${Math.round(versionTimeoutMs / 1000)}秒リトライ後も失敗: ${lastError})`);
    throw new Error("unreachable");
  }
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
// 到着順に依存しない書き方にすること: broadcastThrottleMs 設定時は状態 push が trailing に
// 遅延し、event effect (即時) が先に届き得る (スナップショット+合流の正規の挙動)
const ws = new WebSocket(`${wsBase}/rooms/${NS}/${ROOM}/ws?token=${encodeURIComponent(clientToken)}`);
type Msg = { type: string; event?: string; code?: string; state?: { count?: number; lastActorId?: string | null }; payload?: { count?: number } };
let initial: Msg | null = null;
let updated: Msg | null = null;
let milestone: Msg | null = null;
let forbidden: Msg | null = null;
try {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket 応答タイムアウト (15秒)")), 15_000);
    let resetSent = false;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as Msg;
      if (msg.type === "state" && initial === null) {
        // 接続直後の初期状態 (合流対象外・必ず最初の state)
        initial = msg;
        ws.send(JSON.stringify({ v: ROOM_PROTOCOL_VERSION, type: "dispatch", action: { type: "increment", payload: { amount: 5 } } }));
        return;
      }
      if (msg.type === "state" && msg.state?.count === 10) updated = msg;
      if (msg.type === "event" && msg.event === "milestone") milestone = msg;
      if (msg.type === "error") forbidden = msg;
      // increment の反映 (state + event) が揃ってから禁止 action を送る
      if (updated && milestone && !resetSent) {
        resetSent = true;
        ws.send(JSON.stringify({ v: ROOM_PROTOCOL_VERSION, type: "dispatch", action: { type: "reset" } }));
      }
      if (updated && milestone && forbidden) {
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

// TS はクロージャ内での代入を追跡できず never に絞り込むため、明示キャストで戻す
const initialMsg = initial as Msg | null;
const updatedMsg = updated as Msg | null;
const milestoneMsg = milestone as Msg | null;
const forbiddenMsg = forbidden as Msg | null;
check("6. WS 初期状態受信", initialMsg?.type === "state" && initialMsg.state?.count === 5, JSON.stringify(initialMsg));
check("7. WS クライアント dispatch (許可リスト内)", updatedMsg?.state?.count === 10 && updatedMsg?.state?.lastActorId === "check-user", JSON.stringify(updatedMsg));
check("8. WS event effect (milestone)", milestoneMsg?.payload?.count === 10, JSON.stringify(milestoneMsg));
check("9. WS 許可リスト外アクション拒否", forbiddenMsg?.code === "action_forbidden", JSON.stringify(forbiddenMsg));

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
