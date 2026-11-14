// src/app/api/messaging/unsubscribe/route.test.mts
// /api/messaging/unsubscribe の検査(Factory と記録の service は偽物、トークンの検査は本物)。
// - POST ?token=: 正しければ記録して JSON { ok: true }(メールソフトのワンクリックの本文 List-Unsubscribe=One-Click でも同じ)
// - 無い・壊れたトークンは 400 JSON。古い引数の名前 ?t= は受けない。HTML は返さない(Accept: text/html でも JSON)
// - GET は無い(export しない)
// 実行: pnpm test src/app/api/messaging/unsubscribe/route.test.mts

import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest } from "next/server";

type Handler = (req: NextRequest) => Promise<Response>;
mock.module("@/wiring/apiRoute", { namedExports: { createApiRoute: (_options: unknown, handler: Handler) => handler } });

const tokenModule = await import("@/features/core/messaging/services/server/unsubscribe/token");
const recorded: unknown[] = [];
mock.module("@/features/core/messaging/services/server/unsubscribe", {
  namedExports: {
    UNSUBSCRIBE_TOKEN_PARAM: tokenModule.UNSUBSCRIBE_TOKEN_PARAM,
    verifyUnsubscribeToken: tokenModule.verifyUnsubscribeToken,
    recordUnsubscribe: async (payload: unknown) => {
      recorded.push(payload);
      return { recorded: true };
    },
  },
});

process.env[tokenModule.UNSUBSCRIBE_SECRET_ENV] = "test-secret";
const route = await import("./route.ts");
const USER = "user:3f1c2b9a-1d2e-4f50-8a9b-0c1d2e3f4a5b";
const token = tokenModule.signUnsubscribeToken({ recipientKey: USER, category: "marketing", channel: "email" });
const post = (query: string, init: { body?: string; accept?: string } = {}) =>
  route.POST(
    new NextRequest(`http://localhost/api/messaging/unsubscribe${query}`, {
      method: "POST",
      body: init.body,
      headers: { ...(init.accept ? { accept: init.accept } : {}), ...(init.body ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    }),
  );

beforeEach(() => {
  recorded.length = 0;
});

test("ワンクリックの POST(本文 List-Unsubscribe=One-Click)は記録して JSON", async () => {
  const res = await post(`?token=${encodeURIComponent(token)}`, { body: "List-Unsubscribe=One-Click" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(recorded.length, 1);
});

test("Accept: text/html でも HTML は返さない", async () => {
  const res = await post(`?token=${encodeURIComponent(token)}`, { accept: "text/html" });
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
});

test("無い・壊れた・古い引数 t のトークンは 400 JSON で記録しない", async () => {
  for (const query of ["", "?token=x.y", `?t=${encodeURIComponent(token)}`]) {
    const res = await post(query);
    assert.equal(res.status, 400, query);
    assert.deepEqual(await res.json(), { ok: false, error: "invalid_token" });
  }
  assert.equal(recorded.length, 0);
});

test("GET は無い", () => {
  assert.equal("GET" in route, false);
});
