// src/features/core/admin/hooks/useAdminMenu.test.tsx
// サイドバーが描くメニューの回帰: 管理の枠の門番の値(clientGateState("admin"))とセッションのロールで絞る。
// 閉じた状態は一覧の規則の enabled を一時的に差し替えて作る(config の値に依らない)。実行: pnpm test src/features/core/admin

import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { clientGateState, type FeatureName, type GatedFeatureRule } from "@/featureGate";
import { GateProvider } from "@/featureGate/client";
import { rules } from "@/featureGate/node";
import type { AdminMenuBuiltCategory } from "@/features/core/admin/menu/types";
import { AuthSessionContext } from "@/features/core/auth/components/AuthSessionContext";
import type { SessionUser } from "@/features/core/auth/entities/session";

import { useAdminMenu } from "./useAdminMenu";

function withRules<T>(states: Partial<Record<FeatureName, boolean>>, fn: () => T): T {
  const saved = new Map<GatedFeatureRule, GatedFeatureRule["enabled"]>();
  for (const rule of rules) {
    saved.set(rule, rule.enabled);
    const state = states[rule.name];
    rule.enabled = () => state ?? true;
  }
  try {
    return fn();
  } finally {
    for (const [rule, enabled] of saved) rule.enabled = enabled;
  }
}

function Probe({ onMenu }: { onMenu: (menu: AdminMenuBuiltCategory[]) => void }) {
  onMenu(useAdminMenu());
  return null;
}

function menuFor(role: string | null): AdminMenuBuiltCategory[] {
  let captured: AdminMenuBuiltCategory[] | undefined;
  const user = role === null ? null : ({ role } as unknown as SessionUser);
  renderToStaticMarkup(
    <GateProvider state={clientGateState("admin")}>
      <AuthSessionContext.Provider value={{ user, isAuthenticated: user !== null, refreshSession: async () => {} }}>
        <Probe onMenu={(m) => (captured = m)} />
      </AuthSessionContext.Provider>
    </GateProvider>,
  );
  assert.ok(captured);
  return captured;
}

const shape = (menu: AdminMenuBuiltCategory[]) => menu.map((c) => [c.key, c.rows.map((r) => r.itemKey)]);

test("全部開いた admin: 上流の 6 カテゴリーと行", () => {
  assert.deepEqual(withRules({}, () => shape(menuFor("admin"))), [
    ["marketing", ["notifications", "notificationTemplates", "coupons"]],
    ["requests", ["bankTransferReviews"]],
    ["data", ["dataMenu", "dataMenu", "dataMenu"]],
    ["users", ["usersGeneral", "usersSystem", "usersDemo", "userTags"]],
    ["community", ["chatRooms"]],
    ["system", ["settingSections", "settingSections"]],
  ]);
});

test("閉じた規則の住所の行は描かず、行の無いカテゴリーも描かない", () => {
  const menu = withRules({ bankTransferReview: false, notificationBroadcast: false, adminChatRooms: false }, () => shape(menuFor("admin")));
  assert.deepEqual(menu, [
    ["marketing", ["notificationTemplates", "coupons"]],
    ["data", ["dataMenu", "dataMenu", "dataMenu"]],
    ["users", ["usersGeneral", "usersSystem", "usersDemo", "userTags"]],
    ["system", ["settingSections", "settingSections"]],
  ]);
});

test("ログインしていない・admin でない: ロールの絞りのある行は描かない", () => {
  const expected = [
    ["marketing", ["notifications", "notificationTemplates", "coupons"]],
    ["data", ["dataMenu", "dataMenu", "dataMenu"]],
    ["community", ["chatRooms"]],
    ["system", ["settingSections", "settingSections"]],
  ];
  assert.deepEqual(withRules({}, () => shape(menuFor("user"))), expected);
  assert.deepEqual(withRules({}, () => shape(menuFor(null))), expected);
});
