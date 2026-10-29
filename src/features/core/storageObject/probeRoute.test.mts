// src/features/core/storageObject/probeRoute.test.mts
// POST /api/media/probe の迂回拒否の回帰テスト（R03）。
// - priv の ref は用途の read（この管理者で resolveRead）を通ったときだけ、その署名 URL を lib に渡す。admin の暗黙の通過なし
// - storagePath は旧バケット内だけ。pub / priv の保存先と重なるパスは lib を呼ばずに 400
// 判定（resolveRead・旧バケットの判定・probeMedia）をモックし、ルートの分岐を確かめる。
// 実行: pnpm test:storage-object

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { NextRequest } from "next/server";

type Resolution = { kind: "redirect"; url: string } | { kind: "unauthenticated" } | { kind: "not_found" };

const ADMIN = { userId: "33333333-3333-4333-8333-333333333333", role: "admin", status: "active", isDemo: false };

let resolution: Resolution = { kind: "not_found" };
let resolveCalls: { id: string; use?: string; user: unknown }[] = [];
let probed: unknown[] = [];

mock.module("@/features/core/storageObject/services/server/storageObjectService", {
  namedExports: {
    storageObjectService: {
      resolveRead: async (id: string, options: { use?: string; loadUser: () => Promise<unknown> }) => {
        resolveCalls.push({ id, use: options.use, user: await options.loadUser() });
        return resolution;
      },
    },
  },
});
// ルートの門（admin）は Factory が DB 同期の利用者で評価し、その利用者を ctx.user で渡す
mock.module("@/features/core/auth/services/server/session/getSessionUser", {
  namedExports: { getSessionUser: async () => ADMIN },
});
mock.module("@/lib/mediaProbe", {
  namedExports: {
    probeMedia: async (ref: unknown) => {
      probed.push(ref);
      return { ok: true, container: "mp4", durationSec: 1, hasVideoTrack: true, hasAudioTrack: false, video: null, audio: null };
    },
  },
});
// 旧バケット = old。priv はその "priv/" 配下にある構成を再現する
mock.module("@/lib/storage/server", {
  namedExports: {
    legacyLocationOfPath: (path: string) => (path.startsWith("priv/") ? null : { bucket: "old", path }),
  },
});
mock.module("@/features/core/auth/services/server/session/getTokenOnlySession", {
  namedExports: { getTokenOnlySession: async () => null },
});
mock.module("@/features/core/rateLimit/services/server/wrappers/rateLimitHelper", {
  namedExports: { checkRateLimit: async () => ({ allowed: true }) },
});

const { POST } = await import("@/app/api/media/probe/route");

const ID = "01920000-0000-7000-8000-000000000001";
const PRIV_REF = `storage://priv/chatRoom.video/${ID}.mp4`;

const call = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/media/probe", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({}) },
  );

function reset(next: Resolution) {
  resolution = next;
  resolveCalls = [];
  probed = [];
}

test("priv の ref: 用途の read が許さなければ 404 で、lib を呼ばない（admin の暗黙の通過なし）", async () => {
  reset({ kind: "not_found" });
  const res = await call({ ref: PRIV_REF });
  assert.equal(res.status, 404);
  assert.equal(probed.length, 0);
  assert.deepEqual(resolveCalls, [{ id: ID, use: "probe", user: ADMIN }]);
});

test("priv の ref: 許されたら、その署名 URL を authorizedUrl で渡す（downloadUrl に ref を入れても同じ）", async () => {
  reset({ kind: "redirect", url: "https://storage.example.test/signed?ttl=120" });
  const res = await call({ downloadUrl: PRIV_REF });
  assert.equal(res.status, 200);
  assert.deepEqual(probed, [{ authorizedUrl: "https://storage.example.test/signed?ttl=120" }]);
});

test("storagePath: 管理下の保存先と重なるパスは 400 で、lib を呼ばない", async () => {
  reset({ kind: "not_found" });
  const res = await call({ storagePath: `priv/chatRoom.video/${ID}.mp4` });
  assert.equal(res.status, 400);
  assert.equal(probed.length, 0);
  assert.equal(resolveCalls.length, 0);
});

test("storagePath: 旧バケット内のパスは今どおり lib に渡す", async () => {
  reset({ kind: "not_found" });
  const res = await call({ storagePath: "uploads/a.mp4" });
  assert.equal(res.status, 200);
  assert.deepEqual(probed, [{ storagePath: "uploads/a.mp4" }]);
});

test("形式違いの ref は 400", async () => {
  reset({ kind: "redirect", url: "https://should-not-be-used" });
  const res = await call({ ref: "storage://other/x" });
  assert.equal(res.status, 400);
  assert.equal(probed.length, 0);
});
