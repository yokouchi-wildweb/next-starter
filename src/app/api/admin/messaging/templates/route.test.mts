// src/app/api/admin/messaging/templates/route.test.mts
// /api/admin/messaging/templates 以下の 4 ファイル(一覧と作る・1 件の読む / 直す / 消す・版の一覧・版 1 つ)の検査。公開の口(D134)・取り下げの口(D137)は無い(Factory・門・messaging の service は偽物)。
// - 宣言: 全部の口が access { roleCategories: ["admin"] }
// - 門 messagingTemplates が閉なら 404 で service を呼ばない
// - 一覧の条件・body・id・版の番号をそのまま service へ渡す
// 実行: pnpm test src/app/api/admin/messaging/templates/route.test.mts

import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest, NextResponse } from "next/server";

const { DomainError } = await import("@/lib/errors");

const declared: { operation: string; access: unknown }[] = [];
type Handler = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<unknown>;
const createApiRoute = (options: { operation: string; access: unknown }, handler: Handler) => {
  declared.push({ operation: options.operation, access: options.access });
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return NextResponse.json(await handler(req, { params: await ctx.params }));
    } catch (error) {
      if (error instanceof DomainError) return NextResponse.json({ message: error.message }, { status: error.status });
      throw error;
    }
  };
};
mock.module("@/wiring/apiRoute", { namedExports: { createApiRoute } });

let gateOpen = true;
mock.module("@/featureGate", {
  namedExports: {
    gate: {
      assert: (name: string) => {
        assert.equal(name, "messagingTemplates");
        if (!gateOpen) throw new DomainError("not found", { status: 404 });
      },
    },
  },
});

const calls: unknown[][] = [];
const record =
  (name: string) =>
  async (...args: unknown[]) => {
    calls.push([name, ...args]);
    return name === "listMessageTemplateVersions" ? [] : { ok: name };
  };
mock.module("@/features/core/messaging/services/server/messagingService", {
  namedExports: {
    messagingService: Object.fromEntries(
      [
        "listMessageTemplates",
        "createMessageTemplate",
        "getMessageTemplate",
        "updateMessageTemplate",
        "deleteMessageTemplate",
        "listMessageTemplateVersions",
        "getMessageTemplateVersion",
      ].map((name) => [name, record(name)]),
    ),
  },
});

const root = await import("./route.ts");
const one = await import("./[id]/route.ts");
const versions = await import("./[id]/versions/route.ts");
const version = await import("./[id]/versions/[version]/route.ts");

const BASE = "http://localhost/api/admin/messaging/templates";
const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });

beforeEach(() => {
  gateOpen = true;
  calls.length = 0;
});

test("宣言: 7 つの口(GET・POST / GET・PATCH・DELETE [id] / 版の一覧 / 版 1 つ)が全部管理者だけ", () => {
  assert.equal(declared.length, 7);
  assert.ok(declared.some((entry) => entry.operation === "DELETE /api/admin/messaging/templates/[id]"));
  for (const entry of declared) assert.deepEqual(entry.access, { roleCategories: ["admin"] }, entry.operation);
});

test("引数をそのまま渡す", async () => {
  const body = { key: "k", name: "n" };
  await root.GET(new NextRequest(`${BASE}?kind=promotion&limit=5`), ctx());
  await root.POST(new NextRequest(BASE, { method: "POST", body: JSON.stringify(body) }), ctx());
  await one.GET(new NextRequest(`${BASE}/${ID}`), ctx({ id: ID }));
  await one.PATCH(new NextRequest(`${BASE}/${ID}`, { method: "PATCH", body: JSON.stringify({ name: "x" }) }), ctx({ id: ID }));
  await one.DELETE(new NextRequest(`${BASE}/${ID}`, { method: "DELETE" }), ctx({ id: ID }));
  const list = await versions.GET(new NextRequest(`${BASE}/${ID}/versions`), ctx({ id: ID }));
  assert.deepEqual(await list.json(), { items: [] });
  await version.GET(new NextRequest(`${BASE}/${ID}/versions/2`), ctx({ id: ID, version: "2" }));
  assert.deepEqual(calls, [
    ["listMessageTemplates", { kind: "promotion", limit: "5" }],
    ["createMessageTemplate", body],
    ["getMessageTemplate", ID],
    ["updateMessageTemplate", ID, { name: "x" }],
    ["deleteMessageTemplate", ID],
    ["listMessageTemplateVersions", ID],
    ["getMessageTemplateVersion", ID, 2],
  ]);
});

test("門が閉なら 404 で service を呼ばない", async () => {
  gateOpen = false;
  const responses = [
    await root.GET(new NextRequest(BASE), ctx()),
    await root.POST(new NextRequest(BASE, { method: "POST", body: "{}" }), ctx()),
    await one.GET(new NextRequest(`${BASE}/${ID}`), ctx({ id: ID })),
    await one.PATCH(new NextRequest(`${BASE}/${ID}`, { method: "PATCH", body: "{}" }), ctx({ id: ID })),
    await one.DELETE(new NextRequest(`${BASE}/${ID}`, { method: "DELETE" }), ctx({ id: ID })),
    await versions.GET(new NextRequest(`${BASE}/${ID}/versions`), ctx({ id: ID })),
    await version.GET(new NextRequest(`${BASE}/${ID}/versions/1`), ctx({ id: ID, version: "1" })),
  ];
  for (const res of responses) assert.equal(res.status, 404);
  assert.equal(calls.length, 0);
});
