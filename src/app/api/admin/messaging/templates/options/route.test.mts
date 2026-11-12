// /api/admin/messaging/templates/options の検査(Factory・門・テンプレートの service は偽物)。
// - 宣言: access { roleCategories: ["admin"] }
// - 門 messagingTemplates が閉なら 404 で service を呼ばない / 開なら service の値を返す
// 実行: pnpm test src/app/api/admin/messaging/templates/options/route.test.mts

import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest, NextResponse } from "next/server";

const { DomainError } = await import("@/lib/errors");

const declared: { operation: string; access: unknown }[] = [];
type Handler = (req: NextRequest) => Promise<unknown>;
const createApiRoute = (options: { operation: string; access: unknown }, handler: Handler) => {
  declared.push({ operation: options.operation, access: options.access });
  return async (req: NextRequest) => {
    try {
      return NextResponse.json(await handler(req));
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

let calls = 0;
const OPTIONS = { channels: [{ key: "email", label: "メール" }], categories: [], baseAllowedKeys: ["serviceName"] };
mock.module("@/features/core/messaging/services/server/templates", {
  namedExports: {
    getMessageTemplateOptions: async () => {
      calls += 1;
      return OPTIONS;
    },
  },
});

const route = await import("./route.ts");
const URL = "http://localhost/api/admin/messaging/templates/options";

beforeEach(() => {
  gateOpen = true;
  calls = 0;
});

test("宣言: 管理者だけ", () => {
  assert.deepEqual(declared, [{ operation: "GET /api/admin/messaging/templates/options", access: { roleCategories: ["admin"] } }]);
});

test("開: service の値を返す", async () => {
  const res = await route.GET(new NextRequest(URL));
  assert.deepEqual(await res.json(), OPTIONS);
  assert.equal(calls, 1);
});

test("閉: 404 で service を呼ばない", async () => {
  gateOpen = false;
  const res = await route.GET(new NextRequest(URL));
  assert.equal(res.status, 404);
  assert.equal(calls, 0);
});
