// src/featureGate/checks/addressCheck.test.ts
// 読み込み後の一覧の住所の検査(node/addressCheck.ts の checkAddresses、D25・D31・D34 K5)の単体テスト(作り物の一覧):
// - 二重書き: 同じ住所を共通の機能の無い 2 つの持ち主が持つと止める(手書き同士・手書きと導出)。例外の表と、当たらない行
// - 入れ子の依存: 親の前方一致の下の住所の持ち主が親に dependsOn していないと止める(推移的で可、同じ機能は可、= の完全一致は親にならない、導出の住所の下も)
// 上流の実物で 0 件なのは scripts/structure/proxies/featureGate.test.mjs。実行: pnpm test src/featureGate/checks/addressCheck.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { checkAddresses } from "@/featureGate/node";
import type { DerivedPath } from "@/featureGate/ruleList";

const rule = (name: string, pathPatterns: string[], dependsOn: string[] = [], features: string[] = []) => ({ name, pathPatterns, dependsOn, features }) as never;
const none: DerivedPath[] = [];

test("二重書き: 手書き同士・手書きと導出の住所を止める(共通の機能があれば通る)", () => {
  const problems = checkAddresses([rule("a", ["/x"]), rule("b", ["=/x/"])], none, {});
  assert.equal(problems.length, 1);
  assert.match(problems[0], /住所 \/x を 2 つの機能が持つ\(a の手書き \/ b の手書き\)/);
  const derived: DerivedPath[] = [{ pattern: "/api/shop", kind: "domainApi", folders: ["shop"] }];
  assert.match(checkAddresses([rule("shopAdmin", ["/api/shop"]), rule("shop", [], [], ["shop"])], derived, {})[0], /住所 \/api\/shop を 2 つの機能が持つ\(shopAdmin の手書き \/ 汎用 API\(shop\) の導出\)/);
  assert.deepEqual(checkAddresses([rule("shop", ["/api/shop"], [], ["shop"])], derived, {}), [], "同じ機能が手書きと導出で持つのは通る");
});

test("二重書き: 例外の表の住所は通し、当たらない行は止める(一覧に無い住所の行は数えない)", () => {
  const list = [rule("a", ["/x"]), rule("b", ["/x"]), rule("c", ["/y"])];
  assert.deepEqual(checkAddresses(list, none, { "/x": "理由" }), []);
  assert.match(checkAddresses([rule("a", ["/x"]), rule("c", ["/y"])], none, { "/x": "理由" })[0], /例外 \/x はもう当たらない/);
  assert.deepEqual(checkAddresses([rule("c", ["/y"])], none, { "/x": "理由" }), [], "その住所が一覧に無ければ数えない");
});

test("入れ子: 親の前方一致の下の住所は親に dependsOn が要る(推移的で可、同じ機能は可)", () => {
  assert.match(checkAddresses([rule("coupon", ["/admin/coupons"]), rule("referral", ["/admin/coupons/invite"])], none, {})[0], /住所 \/admin\/coupons\/invite\(referral の手書き\)が \/admin\/coupons\(coupon の手書き\)の下にあるのに、referral が coupon に dependsOn していない。dependsOn に "coupon" を足す/);
  assert.deepEqual(checkAddresses([rule("coupon", ["/admin/coupons"]), rule("referral", ["/admin/coupons/invite"], ["coupon"])], none, {}), []);
  assert.deepEqual(checkAddresses([rule("wallet", ["/wallet"]), rule("payment", [], ["wallet"]), rule("buy", ["/wallet/coin/purchase"], ["payment"])], none, {}), [], "推移的");
  assert.deepEqual(checkAddresses([rule("wallet", ["/wallet", "/wallet/history"])], none, {}), [], "同じ機能");
  assert.deepEqual(checkAddresses([rule("mypage", ["=/mypage"]), rule("invite", ["/mypage/invite"])], none, {}), [], "= の完全一致は親にならない");
  assert.deepEqual(checkAddresses([rule("demo", ["/demo"]), rule("demo2", ["/demo-login"])], none, {}), [], "セグメント境界の前方一致");
});

test("入れ子: 導出の住所の下も見る(汎用 API の下の手書き、cron は読むドメインの持ち主)", () => {
  const derived: DerivedPath[] = [{ pattern: "/api/notification", kind: "domainApi", folders: ["core/notification"] }];
  const list = (deps: string[]) => [rule("notification", [], [], ["core/notification"]), rule("broadcast", ["/api/notification/send"], deps)];
  assert.match(checkAddresses(list([]), derived, {})[0], /\/api\/notification\/send\(broadcast の手書き\)が \/api\/notification\(汎用 API\(core\/notification\) の導出\)の下/);
  assert.deepEqual(checkAddresses(list(["notification"]), derived, {}), []);
});

test("fork の規則も同じに止まる(上流の住所の下に足した規則は上流の機能に dependsOn が要る。直し方を示す)", () => {
  const problems = checkAddresses([rule("signup", ["/signup"]), rule("signupOAuth", ["=/signup/oauth"])], none, {});
  assert.equal(problems.length, 1);
  assert.match(problems[0], /signupOAuth が signup に dependsOn していない。dependsOn に "signup" を足す\(依存の根拠が無ければ両方に依存する小さな機能へ住所を移す\)/);
});
