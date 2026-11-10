// .notices/20261109-171458-feature-gate-foundation.feature-gate-l3.test.mjs
// codemod feature-gate-l3 の回帰テスト(fixture の fork。取り込み前の版は readOld で渡し、上流の規則の名前も渡す)。
// 実行: pnpm test .notices/20261109-171458-feature-gate-foundation.feature-gate-l3.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  addDependsOn,
  oldSwitchValue,
  plan,
  planNestedDepends,
  readBooleanAt,
  removeClosable,
  renameFeaturesKey,
  writeSwitch,
} from "./20261109-171458-feature-gate-foundation.feature-gate-l3.mjs";

// 上流の switches.config.ts の頭のコメント(例の行に `export default { … }` を含む)
const SWITCHES_HEADER = "// 例: `export default { wallet: false, sampleDomain: false } satisfies FeatureSwitches;` / 書く道具: pnpm ops features set <名前> on|off\n";
const rule = (body) => `import type { FeatureGateRule } from "@/featureGate";\n\nexport const rule: FeatureGateRule = {\n${body}};\n`;

function fork(files) {
  const root = mkdtempSync(join(tmpdir(), "gate-l3-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const APP_FEATURES_OLD = 'export const APP_FEATURES = {\n  wallet: { enabled: false },\n  marketing: { coupon: { enabled: true } },\n  pages: { mypage: true },\n} as const;\n';
const OLD = {
  "src/featureGate/rules/wallet.ts": 'import { APP_FEATURES } from "@/config/app/app-features.config";\nexport const rule = {\n  pathPatterns: ["/wallet"],\n  features: ["core/wallet"],\n  enabled: () => APP_FEATURES.wallet.enabled,\n};\n',
  "src/featureGate/rules/coupon.ts": 'import { APP_FEATURES } from "@/config/app/app-features.config";\nexport const rule = {\n  pathPatterns: ["/admin/coupons"],\n  enabled: () => APP_FEATURES.marketing.coupon.enabled,\n};\n',
  "src/featureGate/rules/mypageOther.ts": 'export const rule = {\n  pathPatterns: ["/mypage/other"],\n  enabled: () => A.pause || A.withdraw,\n};\n',
  "src/featureGate/rules/shop.ts": 'import { SHOP_CONFIG } from "@/features/shop/config";\nexport const rule = {\n  pathPatterns: ["/admin/shops"],\n  features: ["shop"],\n  enabled: () => SHOP_CONFIG.enabled,\n};\n',
  "src/config/app/app-features.config.ts": APP_FEATURES_OLD,
  "src/features/shop/config.ts": 'import override from "@/config/features/shop.config";\nconst defaults = { enabled: true };\nexport const SHOP_CONFIG = def(defaults).compose(override);\n',
  "src/config/features/shop.config.ts": "export default { enabled: false } satisfies ShopOverride;\n",
  "src/featureGate/rules/friendApply.ts": 'import { APP_FEATURES } from "@/config/app/app-features.config";\nexport const rule = {\n  pathPatterns: ["/api/me/friend"],\n  enabled: () => APP_FEATURES.marketing.coupon.enabled,\n};\n',
  "src/featureGate/rules/both.ts": 'export const rule = {\n  pathPatterns: ["/both"],\n  enabled: () => APP_FEATURES.wallet.enabled && OWN.x,\n};\n',
  "src/featureGate/rules/envOnly.ts": 'export const rule = {\n  pathPatterns: ["/env"],\n  enabled: () => LINE_ENABLED,\n};\n',
};
const readOld = (p) => OLD[p] ?? null;

function sampleFork() {
  return fork({
    // 取り込み後: 上流の規則は defaultEnabled、fork の規則は今のまま
    "src/featureGate/rules/wallet.ts": rule('  pathPatterns: ["/wallet"],\n  domains: ["core/wallet"],\n  defaultEnabled: true,\n'),
    "src/featureGate/rules/coupon.ts": rule('  pathPatterns: ["/admin/coupons", "/api/me/coupon-issuer"],\n  defaultEnabled: true,\n'),
    "src/featureGate/rules/mypageOther.ts": rule('  anyOf: ["pause", "withdraw"],\n  pathPatterns: ["/mypage/other"],\n'),
    "src/featureGate/rules/shop.ts": OLD["src/featureGate/rules/shop.ts"],
    "src/featureGate/rules/friendCouponAdmin.ts": rule('  pathPatterns: ["/admin/coupons/friend-coupon"],\n  enabled: () => FRIEND_CONFIG.enabled && x(),\n'),
    "src/featureGate/rules/couponIssuerApplyClosed.ts": rule('  pathPatterns: ["/api/me/coupon-issuer/apply"],\n  defaultEnabled: false,\n'),
    "src/config/featureGate/switches.config.ts": `${SWITCHES_HEADER}import type { FeatureSwitches } from "@/featureGate";\n\nexport default {} satisfies FeatureSwitches;\n`,
    "src/features/shop/domain.json": '{\n  "singular": "shop",\n  "closable": true,\n  "fields": []\n}\n',
    "src/featureGate/required/coupon.ts": "export const required = { reason: 'x' };\n",
    "src/features/shop/legacy.ts": "if (APP_FEATURES.wallet.enabled) run();\nconst r = APP_FEATURES.marketing.referral;\nconst ok = APP_FEATURES.adminConsole.enableUserManagement;\n",
    "src/featureGate/rules/friendApply.ts": OLD["src/featureGate/rules/friendApply.ts"],
    "src/featureGate/rules/both.ts": OLD["src/featureGate/rules/both.ts"],
    "src/featureGate/rules/envOnly.ts": OLD["src/featureGate/rules/envOnly.ts"],
  });
}
const upstreamRules = new Set(["wallet", "coupon", "mypageOther"]);

test("1. features: → domains:(コメントの中は変えない)", () => {
  assert.equal(renameFeaturesKey('  features: ["a"],\n  // features: ["b"]\n'), '  domains: ["a"],\n  // features: ["b"]\n');
  assert.equal(renameFeaturesKey('  domains: ["a"],\n'), '  domains: ["a"],\n');
});

test("2. 入れ子: fork の規則の住所が別の規則の前方一致の下なら、一番細かい親を dependsOn に足す(足し済み・= の親・セグメント外は足さない)", () => {
  const rules = [
    { name: "coupon", fork: false, text: rule('  pathPatterns: ["/admin/coupons"],\n') },
    { name: "signup", fork: false, text: rule('  pathPatterns: ["/signup", "=/mypage"],\n') },
    { name: "friend", fork: true, text: rule('  pathPatterns: ["/admin/coupons/friend"],\n') },
    { name: "oauth", fork: true, text: rule('  dependsOn: ["signup"],\n  pathPatterns: ["=/signup/oauth"],\n') },
    { name: "mine", fork: true, text: rule('  pathPatterns: ["/mypage/mine", "/signup-closed"],\n') },
    { name: "expr", fork: true, text: rule('  dependsOn: DEPS,\n  pathPatterns: ["/admin/coupons/x"],\n') },
  ];
  const { add, stopped } = planNestedDepends(rules);
  assert.deepEqual(add, [{ name: "friend", parent: "coupon", path: "/admin/coupons/friend" }]);
  assert.equal(stopped.length, 1);
  assert.match(stopped[0], /expr\.ts: 住所 \/admin\/coupons\/x が coupon の下にあるが dependsOn が文字列リテラルの配列でない/);
  assert.match(addDependsOn(rules[2].text, ["coupon"]), /export const rule: FeatureGateRule = \{\n  \/\/ 住所が親の機能の住所の下にある[^\n]*\n  dependsOn: \["coupon"\],\n  pathPatterns/);
  assert.match(addDependsOn('export const rule = {\n  dependsOn: ["a"],\n};\n', ["b"]), /dependsOn: \["a", "b"\]/);
});

test("3. 入切の値の読み: APP_FEATURES の鍵・defineConfig の既定と上書き・() => true は読まない・式は止める", () => {
  assert.deepEqual(oldSwitchValue("() => APP_FEATURES.wallet.enabled", OLD["src/featureGate/rules/wallet.ts"], readOld), { value: false, source: "src/config/app/app-features.config.ts の APP_FEATURES.wallet.enabled" });
  assert.deepEqual(oldSwitchValue("() => SHOP_CONFIG.enabled", OLD["src/featureGate/rules/shop.ts"], readOld), { value: false, source: "src/config/features/shop.config.ts の enabled" });
  assert.equal(oldSwitchValue("() => true", "", readOld), null);
  assert.match(oldSwitchValue("() => A.pause || A.withdraw", "", readOld).problem, /1 つの値を読む形でない/);
  assert.equal(readBooleanAt(APP_FEATURES_OLD, "APP_FEATURES", ["pages", "mypage"]), true);
  assert.equal(writeSwitch("export default {} satisfies FeatureSwitches;\n", "wallet", false), "export default { wallet: false } satisfies FeatureSwitches;\n");
  assert.equal(writeSwitch("export default { wallet: false } satisfies X;\n", "coupon", true), "export default { wallet: false, coupon: true } satisfies X;\n");
  assert.equal(writeSwitch("export default { wallet: true } satisfies X;\n", "wallet", false), "export default { wallet: false } satisfies X;\n");
  // 上流のテンプレート: 頭のコメントの例には書かず、本物の default export に書く
  assert.equal(writeSwitch(`${SWITCHES_HEADER}\nexport default {} satisfies FeatureSwitches;\n`, "wallet", false), `${SWITCHES_HEADER}\nexport default { wallet: false } satisfies FeatureSwitches;\n`);
});

test("4. closable を消す", () => {
  assert.equal(removeClosable('{\n  "a": 1,\n  "closable": true,\n  "b": 2\n}\n'), '{\n  "a": 1,\n  "b": 2\n}\n');
  assert.equal(removeClosable('{\n  "a": 1,\n  "closable": false\n}\n'), '{\n  "a": 1\n}\n');
});

test("走らせる: fork の 1〜6 をまとめて計画し、--apply 相当で書いた後の 2 回目は書く物 0(何度でも同じ)", async () => {
  const root = sampleFork();
  const first = await plan(root, { readOld, upstreamRules });
  const files = [...first.writes.keys()].sort();
  assert.deepEqual(files, [
    "src/config/featureGate/switches.config.ts",
    "src/featureGate/required/couponAttributionReward.ts",
    "src/featureGate/rules/couponIssuerApplyClosed.ts",
    "src/featureGate/rules/friendApply.ts",
    "src/featureGate/rules/friendCouponAdmin.ts",
    "src/featureGate/rules/shop.ts",
    "src/features/shop/domain.json",
  ]);
  // 上流の規則 wallet は fork の値 false が既定 true と違うので switches へ。coupon は既定と同じで書かない。mypageOther は入切でない
  assert.match(first.writes.get("src/config/featureGate/switches.config.ts"), /export default \{ wallet: false \} satisfies FeatureSwitches;/);
  assert.ok(first.writes.get("src/config/featureGate/switches.config.ts").startsWith(SWITCHES_HEADER), "頭のコメントの例は変えない");
  // fork の規則 shop: features → domains、enabled → defaultEnabled: false(上書きの値)
  assert.match(first.writes.get("src/featureGate/rules/shop.ts"), /domains: \["shop"\],\n  defaultEnabled: false,/);
  assert.match(first.writes.get("src/featureGate/rules/friendCouponAdmin.ts"), /dependsOn: \["coupon"\]/);
  assert.match(first.writes.get("src/featureGate/rules/couponIssuerApplyClosed.ts"), /dependsOn: \["coupon"\]/);
  assert.ok(!/closable/.test(first.writes.get("src/features/shop/domain.json")));
  // fork の規則が上流の入切 1 つを読む → dependsOn、式の中で読む → 止める、ほかの条件(env)→ そのまま
  assert.match(first.writes.get("src/featureGate/rules/friendApply.ts"), /dependsOn: \["coupon"\]/);
  assert.ok(!/enabled:/.test(first.writes.get("src/featureGate/rules/friendApply.ts")));
  assert.ok(first.stopped.some((s) => s.startsWith("src/featureGate/rules/both.ts: enabled(() => APP_FEATURES.wallet.enabled && OWN.x)が上流の機能の入切 APP_FEATURES.wallet.enabled = wallet を式の中で読む")), first.stopped.join("\n"));
  assert.ok(!first.stopped.some((s) => s.includes("envOnly.ts")), "入切でない条件はそのまま");
  // 規則の外のコード: 上流の機能の入切だった鍵だけを機能の名前つきで出す(上流で消えた別の値は数えない)
  const legacy = first.stopped.find((s) => s.startsWith("src/features/shop/legacy.ts:"));
  assert.match(legacy, /APP_FEATURES\.wallet\.enabled・APP_FEATURES\.marketing\.referral\.enabled を読む。gate\.enabled \/ useGate\(\)\.enabled\("wallet"・"referral"\)に直す/);
  assert.ok(!/enableUserManagement/.test(legacy));
  for (const [file, text] of first.writes) writeFileSync(join(root, file), text);
  const second = await plan(root, { readOld, upstreamRules });
  assert.deepEqual([...second.writes.keys()], [], "2 回目は書く物 0");
  assert.match(readFileSync(join(root, "src/featureGate/rules/shop.ts"), "utf8"), /defaultEnabled: false/);
});
