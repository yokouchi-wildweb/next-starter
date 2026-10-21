// src/features/core/pairedDevice/services/server/session/principalGuard.test.mts
// principalGuard / requireCurrentPrincipal の判定順と、orUser のユーザー判定の回帰テスト
// 端末・ユーザーのセッションと next/navigation をモックして実際のガードを動かす
// 実行: pnpm test:device-route

import assert from "node:assert/strict";
import { mock, test } from "node:test";

type FakeDevice = { deviceId: string; kind: string; label: string; scope: unknown };
type FakeUser = { userId: string; role: string; status: string; isDemo: boolean };

let currentDevice: FakeDevice | null = null;
let currentUser: FakeUser | null = null;

mock.module("./getSessionDevice.ts", {
  namedExports: { getSessionDevice: async () => currentDevice },
});
mock.module("@/features/core/auth/services/server/session/getSessionUser", {
  namedExports: { getSessionUser: async () => currentUser },
});
mock.module("next/navigation", {
  namedExports: {
    redirect: (to: string) => {
      throw new Error(`REDIRECT:${to}`);
    },
    notFound: () => {
      throw new Error("NOT_FOUND");
    },
  },
});

const { principalGuard, requireCurrentPrincipal } = await import("./principalGuard.ts");
const { matchesPrincipalUserRule } = await import(
  "@/features/core/pairedDevice/utils/principalUserRule.ts"
);

const staffTablet: FakeDevice = { deviceId: "d1", kind: "staff_tablet", label: "T", scope: { storeId: "s1" } };
const admin: FakeUser = { userId: "u1", role: "admin", status: "active", isDemo: false };
const plainUser: FakeUser = { userId: "u2", role: "user", status: "active", isDemo: false };

// kinds は登録済みの kind に型で制限されている（upstream の登録簿は空）ので、テストでは型を外す
const guard = principalGuard as (options: unknown) => Promise<{ principal: string }>;
const requirePrincipal = requireCurrentPrincipal as (options: unknown) => Promise<{ principal: string }>;

test("kinds に合う端末なら、ユーザーより先に端末として通す", async () => {
  currentDevice = staffTablet;
  currentUser = admin;
  const principal = await guard({ kinds: ["staff_tablet"], orUser: { roleCategories: ["admin"] } });
  assert.equal(principal.principal, "device");
});

test("kind が合わない端末は、orUser のルールに合うユーザーとして通す", async () => {
  currentDevice = { ...staffTablet, kind: "table_terminal" };
  currentUser = admin;
  const principal = await guard({ kinds: ["staff_tablet"], orUser: { roleCategories: ["admin"] } });
  assert.equal(principal.principal, "user");
});

test("どちらにも合わなければ redirectTo へ、無ければ 404", async () => {
  currentDevice = null;
  currentUser = plainUser;
  await assert.rejects(
    guard({ kinds: ["staff_tablet"], orUser: { roleCategories: ["admin"] }, redirectTo: "/store/login" }),
    /REDIRECT:\/store\/login/,
  );
  await assert.rejects(guard({ kinds: ["staff_tablet"], orUser: { roleCategories: ["admin"] } }), /NOT_FOUND/);
  await assert.rejects(
    requirePrincipal({ orUser: { roleCategories: ["admin"] }, behavior: "redirect", redirectTo: "/x" }),
    /REDIRECT:\/x/,
  );
});

test("orUser: ステータス → ロールの順に判定する", () => {
  const user = (overrides: Partial<FakeUser>) => ({ ...admin, ...overrides }) as never;
  assert.ok(matchesPrincipalUserRule(user({}), "authenticated"));
  assert.ok(!matchesPrincipalUserRule(user({ status: "suspended" }), "authenticated"), "利用停止は通さない");
  assert.ok(
    matchesPrincipalUserRule(user({ status: "suspended" }), { allowStatuses: ["active", "suspended"] }),
    "allowStatuses で明示すれば通す",
  );
  assert.ok(matchesPrincipalUserRule(user({}), { roleCategories: ["admin"] }));
  assert.ok(!matchesPrincipalUserRule(user({ role: "user" }), { roleCategories: ["admin"] }));
  assert.ok(matchesPrincipalUserRule(user({ role: "user" }), { roles: ["user"] }));
  assert.ok(matchesPrincipalUserRule(user({ role: "user" }), {}), "ロール指定なし = authenticated");
});
