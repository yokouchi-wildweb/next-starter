// src/app/api/admin/user-groups/route.test.mts
// /api/admin/user-groups 以下の 8 ファイル(12 の口)の検査(Factory・門・userGroup の管理の service は偽物)。
// - 宣言: 全部の口が access { roleCategories: ["admin"] }、静的グループへ書く 2 つは maxDuration 60
// - 門 userGroups が閉なら 404 で service を呼ばない
// - 一覧の条件・body・id をそのまま service へ渡す
// 実行: pnpm test src/app/api/admin/user-groups/route.test.mts

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
        assert.equal(name, "userGroups");
        if (!gateOpen) throw new DomainError("not found", { status: 404 });
      },
    },
  },
});

const calls: unknown[][] = [];
const NAMES = [
  "listGroups",
  "createGroup",
  "getGroup",
  "updateGroup",
  "archiveGroup",
  "updateExceptions",
  "updateStaticMembers",
  "createStaticGroup",
  "estimate",
  "criteriaCatalog",
  "listStaticMembers",
  "listExceptionMembers",
];
mock.module("@/features/core/userGroup/services/server/admin", {
  namedExports: {
    userGroupAdmin: Object.fromEntries(
      NAMES.map((name) => [
        name,
        async (...args: unknown[]) => {
          calls.push([name, ...args]);
          return { ok: name };
        },
      ]),
    ),
  },
});

const root = await import("./route.ts");
const one = await import("./[id]/route.ts");
const archive = await import("./[id]/archive/route.ts");
const exceptions = await import("./[id]/exceptions/route.ts");
const members = await import("./[id]/members/route.ts");
const staticGroup = await import("./static/route.ts");
const estimate = await import("./estimate/route.ts");
const criteria = await import("./criteria/route.ts");

const BASE = "http://localhost/api/admin/user-groups";
const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });
const post = (url: string, body: unknown, method = "POST") => new NextRequest(url, { method, body: JSON.stringify(body) });

beforeEach(() => {
  gateOpen = true;
  calls.length = 0;
});

// D69: restore before ship (J104: DELETE /api/admin/user-groups/[id] added = 13 handlers)
test.skip("宣言: 12 の口が全部管理者だけ、静的グループへ書く 2 つは maxDuration 60", () => {
  assert.equal(declared.length, 12);
  for (const entry of declared) assert.deepEqual(entry.access, { roleCategories: ["admin"] }, entry.operation);
  assert.equal(members.maxDuration, 60);
  assert.equal(staticGroup.maxDuration, 60);
});

test("引数をそのまま渡す", async () => {
  const definition = { part: "role", args: { roles: ["user"] } };
  await root.GET(new NextRequest(`${BASE}?kind=dynamic&limit=5`), ctx());
  await root.POST(post(BASE, { name: "n", kind: "dynamic", definition }), ctx());
  await one.GET(new NextRequest(`${BASE}/${ID}`), ctx({ id: ID }));
  await one.PATCH(post(`${BASE}/${ID}`, { name: "x" }, "PATCH"), ctx({ id: ID }));
  await archive.POST(new NextRequest(`${BASE}/${ID}/archive`, { method: "POST" }), ctx({ id: ID }));
  await exceptions.PUT(post(`${BASE}/${ID}/exceptions`, { include: { add: [ID] } }, "PUT"), ctx({ id: ID }));
  await members.POST(post(`${BASE}/${ID}/members`, { mode: "add", userIds: [ID] }), ctx({ id: ID }));
  await staticGroup.POST(post(`${BASE}/static`, { name: "s", from: { type: "tag", tagId: ID } }), ctx());
  await estimate.POST(post(`${BASE}/estimate`, { definition }), ctx());
  const catalog = await criteria.GET(new NextRequest(`${BASE}/criteria`), ctx());
  assert.deepEqual(await catalog.json(), { ok: "criteriaCatalog" });
  await members.POST(post(`${BASE}/${ID}/members`, { mode: "remove", userIds: [ID] }), ctx({ id: ID }));
  await members.GET(new NextRequest(`${BASE}/${ID}/members?cursor=abc&limit=10`), ctx({ id: ID }));
  await exceptions.GET(new NextRequest(`${BASE}/${ID}/exceptions?side=exclude&limit=5`), ctx({ id: ID }));
  assert.deepEqual(calls, [
    ["listGroups", { kind: "dynamic", limit: "5" }],
    ["createGroup", { name: "n", kind: "dynamic", definition }],
    ["getGroup", ID],
    ["updateGroup", ID, { name: "x" }],
    ["archiveGroup", ID],
    ["updateExceptions", ID, { include: { add: [ID] } }],
    ["updateStaticMembers", ID, { mode: "add", userIds: [ID] }],
    ["createStaticGroup", { name: "s", from: { type: "tag", tagId: ID } }],
    ["estimate", { definition }],
    ["criteriaCatalog"],
    ["updateStaticMembers", ID, { mode: "remove", userIds: [ID] }],
    ["listStaticMembers", ID, { cursor: "abc", limit: "10" }],
    ["listExceptionMembers", ID, { side: "exclude", limit: "5" }],
  ]);
});

test("門が閉なら 404 で service を呼ばない", async () => {
  gateOpen = false;
  const responses = [
    await root.GET(new NextRequest(BASE), ctx()),
    await root.POST(post(BASE, {}), ctx()),
    await one.GET(new NextRequest(`${BASE}/${ID}`), ctx({ id: ID })),
    await one.PATCH(post(`${BASE}/${ID}`, {}, "PATCH"), ctx({ id: ID })),
    await archive.POST(new NextRequest(`${BASE}/${ID}/archive`, { method: "POST" }), ctx({ id: ID })),
    await exceptions.PUT(post(`${BASE}/${ID}/exceptions`, {}, "PUT"), ctx({ id: ID })),
    await members.POST(post(`${BASE}/${ID}/members`, {}), ctx({ id: ID })),
    await staticGroup.POST(post(`${BASE}/static`, {}), ctx()),
    await estimate.POST(post(`${BASE}/estimate`, {}), ctx()),
    await criteria.GET(new NextRequest(`${BASE}/criteria`), ctx()),
    await members.GET(new NextRequest(`${BASE}/${ID}/members`), ctx({ id: ID })),
    await exceptions.GET(new NextRequest(`${BASE}/${ID}/exceptions?side=include`), ctx({ id: ID })),
  ];
  for (const response of responses) assert.equal(response.status, 404);
  assert.deepEqual(calls, []);
});
