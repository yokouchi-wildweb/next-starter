// src/featureGate/checks/ruleChains.test.ts
// 上流の規則の組み直し(D25・D28・D31・D34 K3・L3.2)の回帰テスト(実物の規則で):
// - 手書きの住所は規則をまたいで重ならない(同じ住所を 2 つの機能に書かない)。残りの組は理由つきの表(縮む表、当たらない行は失敗)
// - 親を閉じると子も閉じる(dependsOn の連鎖): マイページ → アカウントの 5 画面・その他の操作、クーポン → 紹介、
//   ウォレット → 決済 → 銀行振込レビュー、お知らせ → 全体配信、チャット → チャットの管理画面、デモのログイン → デモ利用者の管理
// 閉じた状態は生成一覧の規則の enabled を一時的に差し替えて作る(config の値に依らない)。実行: pnpm test src/featureGate/checks/ruleChains.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { gate, type FeatureName, type GeneratedFeatureRule } from "@/featureGate";
import { rules as generatedRules } from "@/featureGate/extensions/rules";

const normalize = (pattern: string) => {
  const body = pattern.replace(/^=/, "");
  return body.length > 1 && body.endsWith("/") ? body.slice(0, -1) : body;
};

/** まだ 2 つの機能が書く住所(住所 → 理由)。直したら行を消す */
const SHARED_PATHS: Record<string, string> = {
  "/admin/notification-templates": "テンプレートの管理画面 ↔ テンプレートの組は連絡の議会の直しの後(計画書の OUT_OF_SCOPE)",
  "/api/notificationTemplate": "同上(テンプレートの管理画面の手書きと notificationTemplate の導出)",
  "/mypage/invite": "マイページ × 紹介の小さな機能へ移す(L3.2、指令 05)",
  "/mypage/pause": "マイページ × 休会の小さな機能へ移す(L3.2、指令 05)",
  "/mypage/withdraw": "マイページ × 退会の小さな機能へ移す(L3.2、指令 05)",
};

test("住所: 手書きの住所(と汎用 API の導出)は規則をまたいで重ならない。残りの組は理由つきの表だけ", async () => {
  const { derivedPaths } = await import("@/featureGate/node");
  const owners = new Map<string, Set<string>>();
  const add = (path: string, owner: string) => owners.set(path, new Set([...(owners.get(path) ?? []), owner]));
  for (const rule of generatedRules) for (const pattern of rule.pathPatterns) add(normalize(pattern), rule.name);
  for (const path of derivedPaths) add(normalize(path.pattern), `derived:${path.folders.join(",")}`);
  const shared = [...owners].filter(([, set]) => set.size > 1).map(([path]) => path).sort();
  assert.deepEqual(shared, Object.keys(SHARED_PATHS).sort(), "同じ住所を 2 つの機能に書かない(子に dependsOn して親から消す)");
});

/** 生成一覧の規則の enabled を一時的に差し替える(書いた名前だけ閉、ほかは開) */
function withClosed(closed: FeatureName[], fn: () => void) {
  const saved = new Map<GeneratedFeatureRule, GeneratedFeatureRule["enabled"]>();
  for (const rule of generatedRules) {
    saved.set(rule, rule.enabled);
    rule.enabled = () => !closed.includes(rule.name);
  }
  try {
    fn();
  } finally {
    for (const [rule, enabled] of saved) rule.enabled = enabled;
  }
}

const closedOf = (names: FeatureName[]) => names.filter((name) => !gate.enabled(name));

const CHAINS: { parent: FeatureName; children: FeatureName[]; path: string }[] = [
  {
    parent: "pageMypage",
    children: ["pageMypageAccount", "pageMypageAccountEmail", "pageMypageAccountPassword", "pageMypageAccountPhone", "pageMypageAccountProfile", "mypageOther"],
    path: "/mypage/account/email",
  },
  { parent: "coupon", children: ["referral"], path: "/admin/coupons/invite" },
  { parent: "wallet", children: ["payment", "bankTransferReview"], path: "/admin/bank-transfer-reviews" },
  { parent: "notification", children: ["notificationBroadcast"], path: "/admin/notifications" },
  { parent: "chatRoom", children: ["adminChatRooms"], path: "/admin/chat-rooms" },
  { parent: "demoLogin", children: ["adminDemoUsers"], path: "/admin/users/demo" },
];

test("連鎖: 親を閉じると子(孫)も閉じ、子の住所も閉じる。親が開なら子は自分の値", () => {
  for (const { parent, children, path } of CHAINS) {
    withClosed([parent], () => {
      assert.deepEqual(closedOf(children), children, `${parent} を閉じると ${children.join("・")} も閉`);
      assert.equal(gate.path(path).open, false, `${path} は閉`);
    });
    withClosed([], () => {
      assert.deepEqual(closedOf(children), [], `${parent} が開なら子は開`);
      assert.equal(gate.path(path).open, true);
    });
  }
});

test("連鎖: 紹介・休会・退会はマイページに依存しない(L3.2)。子を閉じても親は開", () => {
  withClosed(["pageMypage"], () => {
    assert.deepEqual(closedOf(["referral", "pause", "withdraw"]), [], "マイページを閉じても機能そのものは閉じない");
    assert.equal(gate.path("/api/auth/pause").open, true);
  });
  withClosed(["referral", "payment", "notificationBroadcast", "adminChatRooms", "adminDemoUsers", "mypageOther"], () => {
    assert.deepEqual(closedOf(["coupon", "wallet", "notification", "chatRoom", "demoLogin", "pageMypage"]), []);
  });
});
