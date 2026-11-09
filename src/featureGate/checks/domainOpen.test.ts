// src/featureGate/checks/domainOpen.test.ts
// ドメインの開閉と導出の住所(D24・D34 K4)の回帰テスト:
// - ドメインの開閉(ruleList.ts の closedDomainsOf・domainEnabled): 開 = そのドメインを features に持つ規則のどれかが開。どの規則にも載らないドメインは常に開
// - 導出の住所(closedDerivedEntries): 汎用 API = ドメインが閉なら閉、cron = 読むドメインのどれかが閉なら閉、設定の節 = 名指す機能のどれかが閉なら閉。
//   rule・redirectTo = 閉じた持ち主(と閉じた名指し)のうち一覧の順で最初
// - 表(closedTables): 閉じたドメインの表だけ
// - 判定(resolvePath・closedPathEntries): 手書き + 導出、当たった閉じた住所のうち一番細かい一致(長い住所、同じ長さは = の完全一致)
// 規則の一覧は作り物(ドメインは生成一覧の domains の実物 core/wallet・core/walletHistory・core/coupon を使う)。実行: pnpm test src/featureGate/checks/domainOpen.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { GatedFeatureRule } from "@/featureGate";
import { closedPathEntries, resolvePath } from "@/featureGate/evaluate";
import { closedTables } from "@/featureGate/node";
import { closedDerivedEntries, closedDomainsOf, domainEnabled, type DerivedPath } from "@/featureGate/ruleList";
import { patternSpecificity } from "@/lib/pathPattern/index.mjs";

const rule = (name: string, features: string[], open: boolean, extra: Partial<GatedFeatureRule> = {}): GatedFeatureRule =>
  ({ name, features, pathPatterns: [], dependsOn: [], tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], enabled: () => open, ...extra }) as unknown as GatedFeatureRule;

test("ドメインの開閉: 2 つの機能が持つドメインは片方が開なら開、両方閉なら閉(持ち主は一覧の順で最初)", () => {
  const both = [rule("users", ["core/wallet"], false), rule("demoUsers", ["core/wallet"], true)];
  assert.equal(domainEnabled("core/wallet", both), true);
  assert.equal(closedDomainsOf(both).has("core/wallet"), false);
  const closed = [rule("users", ["core/wallet"], false), rule("demoUsers", ["core/wallet"], false)];
  assert.equal(domainEnabled("core/wallet", closed), false);
  assert.equal(closedDomainsOf(closed).get("core/wallet")?.name, "users");
});

test("ドメインの開閉: どの機能にも載らないドメインは常に開(生成一覧の domains に無いフォルダ・一覧のどの規則も持たないフォルダ)", () => {
  const list = [rule("wallet", ["core/wallet"], false)];
  assert.equal(domainEnabled("core/user", list), true);
  assert.equal(domainEnabled("core/coupon", list), true, "一覧のどの規則も持たない");
  assert.deepEqual([...closedDomainsOf(list).keys()], ["core/wallet"]);
});

test("表: 閉じたドメインの表だけ(2 つの機能が持つドメインは片方が開なら外さない)", () => {
  assert.deepEqual(closedTables([rule("wallet", ["core/wallet", "core/walletHistory"], false)]), ["wallets", "wallet_lots", "wallet_histories"]);
  assert.deepEqual(closedTables([rule("wallet", ["core/wallet"], false), rule("walletAdmin", ["core/wallet"], true)]), []);
  assert.deepEqual(closedTables([rule("wallet", ["core/wallet"], true)]), []);
});

test("導出の住所: 汎用 API はドメインが閉なら閉、cron は読むドメインのどれかが閉なら閉。答えは閉じた持ち主のうち一覧の順で最初の規則と redirectTo", () => {
  const paths: DerivedPath[] = [
    { pattern: "/api/wallet", kind: "domainApi", folders: ["core/wallet"] },
    { pattern: "/api/cron/both", kind: "cron", folders: ["core/coupon", "core/wallet"] },
    { pattern: "/api/cron/coupon", kind: "cron", folders: ["core/coupon"] },
  ];
  const list = [rule("coupon", ["core/coupon"], true), rule("wallet", ["core/wallet"], false, { redirectTo: "/wallet-closed" })];
  assert.deepEqual(closedDerivedEntries(list, paths), [
    { pattern: "/api/wallet", rule: "wallet", redirectTo: "/wallet-closed" },
    { pattern: "/api/cron/both", rule: "wallet", redirectTo: "/wallet-closed" },
  ]);
  const allClosed = [rule("coupon", ["core/coupon"], false), rule("wallet", ["core/wallet"], false)];
  assert.deepEqual(
    closedDerivedEntries(allClosed, paths).map((e) => `${e.pattern}:${e.rule}`),
    ["/api/wallet:wallet", "/api/cron/both:coupon", "/api/cron/coupon:coupon"],
    "cron が 2 つの閉じたドメインを読めば、持ち主のうち一覧の順で最初",
  );
  assert.deepEqual(closedDerivedEntries([rule("coupon", ["core/coupon"], true), rule("wallet", ["core/wallet"], true)], paths), []);
});

test("細かさ: 長い住所ほど細かく、同じ長さは = の完全一致が細かい", () => {
  assert.ok(patternSpecificity("/admin/coupons/invite") > patternSpecificity("/admin/coupons"));
  assert.ok(patternSpecificity("=/mypage") > patternSpecificity("/mypage"));
  assert.equal(patternSpecificity("/mypage/"), patternSpecificity("/mypage"));
});

test("判定: 当たった閉じた住所のうち一番細かい一致の rule と redirectTo(一覧の順でなく)。手書きと導出を合わせる", () => {
  const list = [
    rule("coupon", ["core/coupon"], false, { pathPatterns: ["/admin/coupons"], redirectTo: "/coupon-closed" }),
    rule("referral", [], false, { pathPatterns: ["/admin/coupons/invite"] }),
    rule("mypage", [], false, { pathPatterns: ["/mypage"] }),
    rule("mypageTop", [], false, { pathPatterns: ["=/mypage"], redirectTo: "/top" }),
    rule("wallet", ["core/wallet"], false, { pathPatterns: ["/wallet"] }),
    rule("payment", [], false, { pathPatterns: ["/api/wallet/purchase"] }),
  ];
  assert.deepEqual(resolvePath("/admin/coupons/invite/x", list), { open: false, rule: "referral", redirectTo: undefined });
  assert.deepEqual(resolvePath("/admin/coupons/x", list), { open: false, rule: "coupon", redirectTo: "/coupon-closed" });
  assert.deepEqual(resolvePath("/mypage", list), { open: false, rule: "mypageTop", redirectTo: "/top" });
  assert.deepEqual(resolvePath("/mypage/other", list), { open: false, rule: "mypage", redirectTo: undefined });
  // 導出の住所(core/wallet の汎用 API /api/wallet)と手書き(payment の /api/wallet/purchase)の入れ子
  assert.deepEqual(resolvePath("/api/wallet/purchase", list), { open: false, rule: "payment", redirectTo: undefined });
  assert.deepEqual(resolvePath("/api/wallet/1", list), { open: false, rule: "wallet", redirectTo: undefined });
  assert.deepEqual(resolvePath("/api/coupon", list), { open: false, rule: "coupon", redirectTo: "/coupon-closed" });
  // 並び: 一番細かい順(同じ細かさは元の順)。並びの順で最初に当たった項目 = 一番細かい一致(hiddenHref・client の path が使う)
  const entries = closedPathEntries(list);
  const specs = entries.map((e) => patternSpecificity(e.pattern));
  assert.deepEqual(specs, [...specs].sort((a, b) => b - a));
  // 子が開けば親の答え
  const open = list.map((r) => (r.name === "referral" ? rule("referral", [], true, { pathPatterns: ["/admin/coupons/invite"] }) : r));
  assert.deepEqual(resolvePath("/admin/coupons/invite", open), { open: false, rule: "coupon", redirectTo: "/coupon-closed" });
  assert.deepEqual(resolvePath("/elsewhere", list), { open: true });
});

test("設定の節: 名指す機能が全部開のときだけ開く(2 機能を名指す節は片方が閉なら閉)。rule = 閉じた名指しのうち一覧の順で最初、一覧に無い名指しは数えない", () => {
  const paths: DerivedPath[] = [
    { pattern: "/admin/settings/shop", kind: "setting", folders: [], features: ["wallet", "payment"] },
    { pattern: "/admin/settings/coins", kind: "setting", folders: [], features: ["wallet"] },
  ];
  const at = (list: GatedFeatureRule[]) => closedDerivedEntries(list, paths).map((e) => `${e.pattern}:${e.rule}`);
  assert.deepEqual(at([rule("payment", [], false), rule("wallet", [], true)]), ["/admin/settings/shop:payment"]);
  assert.deepEqual(at([rule("payment", [], false), rule("wallet", [], false)]), ["/admin/settings/shop:payment", "/admin/settings/coins:wallet"]);
  assert.deepEqual(at([rule("payment", [], true), rule("wallet", [], true)]), []);
  assert.deepEqual(at([rule("wallet", [], true)]), [], "一覧に無い名指し(payment)は閉とみなさない");
  // 判定: 節の住所は手書きの前方一致(/admin/settings)より細かい
  const list = [rule("settingsAll", [], false, { pathPatterns: ["/admin/settings"] }), rule("payment", [], false), rule("wallet", [], true)];
  assert.equal(closedPathEntries(list).find((e) => e.pattern === "/admin/settings/shop")?.rule, undefined, "既定の導出の住所(上流は節 0)には無い");
});
