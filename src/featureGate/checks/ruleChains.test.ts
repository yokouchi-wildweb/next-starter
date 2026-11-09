// src/featureGate/checks/ruleChains.test.ts
// 上流の規則の組み直し(D25・D28・D29・D31・D34 K3・L3.2・L3.3)の回帰テスト(実物の規則で):
// (住所の二重書き・入れ子の依存は読み込み後の検査 node/addressCheck.ts の checkAddresses、実物で 0 件は scripts/structure/proxies/featureGate.test.mjs)
// - 親を閉じると子も閉じる(dependsOn の連鎖): マイページ → アカウントの 5 画面・その他の操作、クーポン → 紹介、
//   ウォレット → 決済 → 銀行振込レビュー、お知らせ → 全体配信、チャット → チャットの管理画面、デモのログイン → デモ利用者の管理
// - 小さな機能(親 × 子、enabled 省略): 親と子のどちらを閉じても閉じ、両方が開なら開
// - 紹介の報酬: ウォレットを閉じれば閉、クーポンを閉じても開(依存はウォレットだけ)
// 閉じた状態は生成一覧の規則の enabled を一時的に差し替えて作る(config の値に依らない)。実行: pnpm test src/featureGate/checks/ruleChains.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { gate, type FeatureName, type GeneratedFeatureRule } from "@/featureGate";
import { rules as generatedRules } from "@/featureGate/extensions/rules";

/** 生成一覧の規則の enabled を一時的に差し替える(書いた名前だけ閉、ほかは開) */
function withClosed(closed: FeatureName[], fn: () => void) {
  const saved = new Map<GeneratedFeatureRule, GeneratedFeatureRule["enabled"]>();
  const savedDefaults = new Map<GeneratedFeatureRule, boolean | undefined>();
  for (const rule of generatedRules) {
    saved.set(rule, rule.enabled);
    // 入切の既定(defaultEnabled)も外し、開閉は enabled の差し替えだけで決める
    savedDefaults.set(rule, rule.defaultEnabled);
    rule.defaultEnabled = undefined;
    rule.enabled = () => !closed.includes(rule.name);
  }
  try {
    fn();
  } finally {
    for (const [rule, enabled] of saved) rule.enabled = enabled;
    for (const [rule, value] of savedDefaults) rule.defaultEnabled = value;
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
  { parent: "notification", children: ["notificationBroadcast", "adminNotificationTemplates"], path: "/admin/notification-templates" },
  { parent: "chatRoom", children: ["adminChatRooms"], path: "/admin/chat-rooms" },
  { parent: "demoLogin", children: ["adminDemoUsers"], path: "/admin/users/demo" },
  { parent: "wallet", children: ["couponAttributionReward", "walletAnalytics"], path: "/api/me/coupon-attribution-rewards" },
];

/** 小さな機能(親 × 子): 住所と、閉じる元の 2 つ */
const SMALL: { name: FeatureName; parents: [FeatureName, FeatureName]; path: string }[] = [
  { name: "demoDeviceFingerprint", parents: ["demoPages", "deviceFingerprint"], path: "/demo/fingerprint" },
  { name: "demoPayment", parents: ["demoPages", "payment"], path: "/demo/dummy-payment" },
  { name: "demoSampleDomain", parents: ["demoPages", "sampleDomain"], path: "/demo/tables" },
  { name: "paymentAnalytics", parents: ["analytics", "payment"], path: "/api/admin/analytics/purchase" },
  { name: "walletAnalytics", parents: ["analytics", "wallet"], path: "/api/admin/analytics/wallet-history" },
  { name: "mypageInvite", parents: ["pageMypage", "referral"], path: "/mypage/invite" },
  { name: "mypagePause", parents: ["pageMypage", "pause"], path: "/mypage/pause" },
  { name: "mypageWithdraw", parents: ["pageMypage", "withdraw"], path: "/mypage/withdraw" },
];

test("小さな機能: enabled を書かず、親と子のどちらを閉じても閉じ(住所も閉)、両方が開なら開", () => {
  for (const { name, parents, path } of SMALL) {
    const rule = generatedRules.find((r) => r.name === name);
    assert.ok(rule && rule.enabled === undefined, `${name}: enabled を書かない`);
    assert.deepEqual(rule.dependsOn, parents);
    for (const parent of parents) {
      withClosed([parent], () => {
        assert.equal(gate.enabled(name), false, `${parent} を閉じると ${name} も閉`);
        const result = gate.path(path);
        assert.equal(result.open, false, `${path} は閉`);
      });
    }
    withClosed([], () => {
      assert.equal(gate.enabled(name), true);
      assert.deepEqual(gate.path(path), { open: true });
    });
  }
  // 住所の答えは一番細かい一致 = 小さな機能(親の前方一致の下でも)。子が閉なら子の機能に依存する小さな機能の名前
  withClosed(["demoPages", "sampleDomain"], () => {
    const result = gate.path("/demo/tables");
    assert.ok(!result.open && result.rule === "demoSampleDomain");
  });
});

test("紹介の報酬: クーポンを閉じても開(表・汎用 API・本人の閲覧)、ウォレットを閉じれば閉", () => {
  withClosed(["coupon"], () => {
    assert.equal(gate.enabled("couponAttributionReward"), true);
    assert.equal(gate.path("/api/couponAttributionReward").open, true);
    assert.equal(gate.path("/api/me/coupon-attribution-rewards").open, true);
  });
  withClosed(["wallet"], () => {
    assert.equal(gate.enabled("couponAttributionReward"), false);
    assert.equal(gate.path("/api/couponAttributionReward").open, false);
  });
});

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
    assert.deepEqual(closedOf(["mypageInvite", "mypagePause", "mypageWithdraw"]), ["mypageInvite", "mypagePause", "mypageWithdraw"], "画面だけ閉じる");
  });
  withClosed(["referral", "payment", "notificationBroadcast", "adminChatRooms", "adminDemoUsers", "mypageOther"], () => {
    assert.deepEqual(closedOf(["coupon", "wallet", "notification", "chatRoom", "demoLogin", "pageMypage"]), []);
  });
});
