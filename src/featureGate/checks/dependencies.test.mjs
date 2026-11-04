// src/featureGate/checks/dependencies.test.mjs
// 依存の検査(D20(b)・L1.12): 閉じられるフォルダ(規則の features)を外から値で import するファイルは、
// (1) 自分のドメインの domainEntry.ts の requires (2) 規則の名前で gate.enabled / gate.assert / useGate().enabled
// (3) その規則で閉じる住所の src/app の下 (4) 同じ規則のフォルダどうし (5) fork の required/<名前> (6) 例外、のどれかでなければ落とす。
// 判定: ./dependencies.mjs。実行: pnpm test:feature-gate
// - 上流の例外は UPSTREAM_DEPENDENCY_EXCEPTIONS(理由つき)、fork の例外は受け口 src/featureGate/dependencyExceptions/<名前>.ts
// - 今の上流の違反は縮む表 UPSTREAM_DEPENDENCY_DEBT(持ち主 = 設定の議会の legate。直った行が表に残ると落ちる)

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

import { dependencyExceptions, rules } from "../node.ts";
import { findDependencyViolations } from "./dependencies.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");

/** 上流の例外(縮む表。当たらなくなった行は失敗) */
const UPSTREAM_DEPENDENCY_EXCEPTIONS = {
  "src/wiring/apiRoute.ts": "常に読まれる API の結線。端末の束(pairedDevice)を Factory に結ぶだけで、端末の判定は pairedDevice の側が gate.enabled(\"pairedDevice\") で自分を閉じる(deviceToken.ts)",
};

const OWNER = "設定の議会の legate(legate-20261023-175358-config-redesign.1)";

/**
 * 今の上流の違反(縮む表、L1.12)。キー = "<ファイル> → <閉じられるフォルダ>"。
 * how の先頭 requires: = 持ち主が domainEntry.ts に requires を書けば消える行 / gate: = gate.enabled などで確かめれば消える行
 */
const UPSTREAM_DEPENDENCY_DEBT = {
  "src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/BankTransferReviewDetailModal.tsx → core/wallet": { owner: OWNER, how: 'gate: 画面で gate.enabled("wallet") を確かめる(payment の前提で閉じるが検査は前提をたどらない)' },
  "src/features/core/analytics/services/server/coinIssuance/sources/couponAttributionReward.ts → core/couponAttributionReward": { owner: OWNER, how: 'gate: gate.enabled("coupon") を確かめてから呼ぶ' },
  "src/features/core/analytics/services/server/coinIssuance/sources/purchaseBonusGap.ts → core/purchaseRequest": { owner: OWNER, how: 'gate: gate.enabled("payment") を確かめてから呼ぶ' },
  "src/features/core/analytics/services/server/purchaseAnalytics.ts → core/purchaseRequest": { owner: OWNER, how: 'gate: gate.enabled("payment") を確かめてから呼ぶ' },
  "src/features/core/analytics/services/server/purchaseDistributionAnalytics.ts → core/purchaseRequest": { owner: OWNER, how: 'gate: gate.enabled("payment") を確かめてから呼ぶ' },
  "src/features/core/analytics/services/server/purchaseRankingAnalytics.ts → core/purchaseRequest": { owner: OWNER, how: 'gate: gate.enabled("payment") を確かめてから呼ぶ' },
  "src/features/core/analytics/services/server/purchaseRegistrationAgeAnalytics.ts → core/purchaseRequest": { owner: OWNER, how: 'gate: gate.enabled("payment") を確かめてから呼ぶ' },
  "src/features/core/analytics/services/server/walletHistoryAnalytics.ts → core/walletHistory": { owner: OWNER, how: 'gate: gate.enabled("wallet") を確かめてから呼ぶ' },
  "src/features/core/analytics/services/server/walletRankingAnalytics.ts → core/walletHistory": { owner: OWNER, how: 'gate: gate.enabled("wallet") を確かめてから呼ぶ' },
  "src/features/core/analytics/services/server/walletStateAnalytics.ts → core/wallet": { owner: OWNER, how: 'gate: gate.enabled("wallet") を確かめてから呼ぶ' },
  "src/features/core/coupon/handlers/init.ts → core/purchaseRequest": { owner: OWNER, how: 'gate または例外: 登録の結線で payment を確かめる(常に読まれる登録)' },
  "src/features/core/couponAttributionReward/entities/drizzle.ts → core/wallet": { owner: OWNER, how: 'requires: couponAttributionReward の domainEntry に wallet' },
  "src/features/core/couponAttributionReward/services/server/grant.ts → core/wallet": { owner: OWNER, how: 'requires: couponAttributionReward の domainEntry に wallet' },
  "src/features/core/couponIssuerGrant/services/server/stats.ts → core/purchaseRequest": { owner: OWNER, how: 'gate: gate.enabled("payment") を確かめてから呼ぶ' },
  "src/features/core/purchaseRequest/components/PurchaseAwaitingReview/index.tsx → core/wallet": { owner: OWNER, how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/components/PurchaseComplete/index.tsx → core/wallet": { owner: OWNER, how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/components/PurchaseFailed/index.tsx → core/wallet": { owner: OWNER, how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/constants/field.ts → core/wallet": { owner: OWNER, how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/entities/drizzle.ts → core/walletHistory": { owner: OWNER, how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/services/server/completion/strategies/walletTopup.ts → core/wallet": { owner: OWNER, how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/services/server/coupon/registerHandler.ts → core/coupon": { owner: OWNER, how: 'gate: gate.enabled("coupon") を確かめてから呼ぶ' },
  "src/features/core/purchaseRequest/services/server/payment/inhouse/inhouseProvider.ts → core/wallet": { owner: OWNER, how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/services/server/wrappers/completePurchase.ts → core/coupon": { owner: OWNER, how: 'gate: gate.enabled("coupon") を確かめてから呼ぶ' },
  "src/features/core/purchaseRequest/services/server/wrappers/initiatePurchase.ts → core/wallet": { owner: OWNER, how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/purchaseRequest/services/server/wrappers/initiatePurchase.ts → core/coupon": { owner: OWNER, how: 'gate: gate.enabled("coupon") を確かめてから呼ぶ' },
  "src/features/core/purchaseRequest/services/server/wrappers/purchaseHelpers.ts → core/wallet": { owner: OWNER, how: 'requires: purchaseRequest の domainEntry に wallet / walletHistory(payment は wallet を前提)' },
  "src/features/core/referral/components/InviteCode/index.tsx → core/coupon": { owner: OWNER, how: 'requires: referral の domainEntry に coupon(referral は coupon を前提)' },
  "src/features/core/referral/services/server/coupon/referralHandler.ts → core/coupon": { owner: OWNER, how: 'requires: referral の domainEntry に coupon(referral は coupon を前提)' },
  "src/features/core/referral/services/server/wrappers/getInviteCodeListWithCounts.ts → core/coupon": { owner: OWNER, how: 'requires: referral の domainEntry に coupon(referral は coupon を前提)' },
  "src/features/core/referral/services/server/wrappers/validateInviteCode.ts → core/coupon": { owner: OWNER, how: 'requires: referral の domainEntry に coupon(referral は coupon を前提)' },
  "src/features/core/storageObject/purposes/purchaseRequest.ts → core/purchaseRequest": { owner: OWNER, how: 'gate または例外: 登録の結線で payment を確かめる(常に読まれる登録)' },
  "src/features/core/wallet/components/WalletBalance/index.tsx → core/bankTransferReview": { owner: OWNER, how: 'gate: 画面側で useGate().enabled("payment") を確かめる' },
  "src/features/core/wallet/components/WalletPurchase/CouponInput.tsx → core/coupon": { owner: OWNER, how: 'gate: 画面側で useGate().enabled("coupon") を確かめる' },
  "src/features/core/wallet/components/WalletPurchase/CouponInput.tsx → core/purchaseRequest": { owner: OWNER, how: 'gate: 画面側で useGate().enabled("payment") を確かめる' },
  "src/features/core/wallet/components/WalletPurchase/CurrencyPurchase.tsx → core/purchaseRequest": { owner: OWNER, how: 'gate: 画面側で useGate().enabled("payment") を確かめる' },
  "src/features/core/wallet/components/WalletPurchase/CurrencyPurchase.tsx → core/bankTransferReview": { owner: OWNER, how: 'gate: 画面側で useGate().enabled("payment") を確かめる' },
  "src/features/core/wallet/components/WalletPurchase/index.tsx → core/bankTransferReview": { owner: OWNER, how: 'gate: 画面側で useGate().enabled("payment") を確かめる' },
};

const keyOf = (v) => `${v.file} → ${v.folder}`;

test("実リポ: 閉じられるフォルダを外から読むファイルは 6 つの形のどれか(上流の違反は縮む表、直った行は表から消す)", () => {
  const exceptionFiles = [...Object.keys(UPSTREAM_DEPENDENCY_EXCEPTIONS), ...dependencyExceptions.map((e) => e.file)];
  const violations = findDependencyViolations({ root: ROOT, rules, exceptionFiles });
  const keys = [...new Set(violations.map(keyOf))];
  const unknown = violations.filter((v) => !(keyOf(v) in UPSTREAM_DEPENDENCY_DEBT));
  assert.deepEqual(
    unknown.map((v) => `${v.file} → ${v.folder}(規則 ${v.rule})`),
    [],
    "閉じられる機能を確かめずに読んでいる。domainEntry.ts の requires・gate.enabled(\"<規則>\")・required/<規則>.ts・dependencyExceptions/ のどれかで通す(src/featureGate/README.md「依存の検査」)",
  );
  const healed = Object.keys(UPSTREAM_DEPENDENCY_DEBT).filter((key) => !keys.includes(key));
  assert.deepEqual(healed, [], "直った行が UPSTREAM_DEPENDENCY_DEBT に残っている(表から消す)");
});

test("実リポ: 例外の行は当たる(縮む表)・理由は空でない", () => {
  const all = { ...UPSTREAM_DEPENDENCY_EXCEPTIONS, ...Object.fromEntries(dependencyExceptions.map((e) => [e.file, e.reason])) };
  for (const [file, reason] of Object.entries(all)) assert.ok(reason.trim().length > 0, `${file}: reason が空`);
  const without = findDependencyViolations({ root: ROOT, rules, exceptionFiles: [] });
  for (const file of Object.keys(all)) {
    assert.ok(without.some((v) => v.file === file), `${file}: 例外が当たらない(行を消す)`);
  }
});

/** 一時リポ: tsconfig の @/*、閉じられるフォルダ core/wallet(規則 wallet、住所 /wallet)と core/coupon(規則 coupon) */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "gate-deps-"));
  const base = {
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
    "src/features/core/wallet/services/server/walletService.ts": "export const walletService = {};\n",
    "src/features/core/walletHistory/services/server/walletHistoryService.ts": "export const h = {};\n",
    "src/features/core/coupon/services/server/couponService.ts": "export const couponService = {};\n",
    ...files,
  };
  for (const [path, text] of Object.entries(base)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
const fixtureRules = [
  { name: "wallet", features: ["core/wallet", "core/walletHistory"], pathPatterns: ["/wallet", "/api/wallet"] },
  { name: "coupon", features: ["core/coupon"], pathPatterns: ["/coupon"] },
];
const IMPORT_WALLET = 'import { walletService } from "@/features/core/wallet/services/server/walletService";\nexport const x = walletService;\n';
const run = (files, opts = {}) => findDependencyViolations({ root: fixture(files), rules: fixtureRules, requiredNames: [], ...opts }).map(keyOf);

test("fixture: 確かめずに読むと落ち、6 つの形で通る", () => {
  const caller = "src/features/core/purchase/services/server/buy.ts";
  assert.deepEqual(run({ [caller]: IMPORT_WALLET }), [`${caller} → core/wallet`]);
  // (1) requires(ドメイン名 = フォルダ名の末尾)
  assert.deepEqual(run({ [caller]: IMPORT_WALLET, "src/features/core/purchase/services/server/domainEntry.ts": 'export const domainEntries = {\n  purchase: { requires: ["wallet"] },\n} satisfies X;\n' }), []);
  // (2) 規則の名前で確かめる(名前が違えば落ちる)
  assert.deepEqual(run({ [caller]: IMPORT_WALLET + 'if (!gate.enabled("wallet")) throw 0;\n' }), []);
  assert.deepEqual(run({ [caller]: IMPORT_WALLET + 'gate.assert("coupon");\n' }), [`${caller} → core/wallet`]);
  assert.deepEqual(run({ [caller]: IMPORT_WALLET + 'const ok = useGate().enabled("wallet");\n' }), []);
  // (3) その規則で閉じる住所の下(動的セグメント・ルートグループも)
  assert.deepEqual(run({ "src/app/(user)/wallet/[slug]/_screen/loader.ts": IMPORT_WALLET, "src/app/api/wallet/route.ts": IMPORT_WALLET }), []);
  assert.deepEqual(run({ "src/app/(user)/mypage/_screen/loader.ts": IMPORT_WALLET }), ["src/app/(user)/mypage/_screen/loader.ts → core/wallet"]);
  // (4) 同じ規則のフォルダどうし
  assert.deepEqual(run({ "src/features/core/walletHistory/services/server/x.ts": IMPORT_WALLET }), []);
  // (5) fork の required/
  assert.deepEqual(run({ [caller]: IMPORT_WALLET }, { requiredNames: ["wallet"] }), []);
  // (6) 例外
  assert.deepEqual(run({ [caller]: IMPORT_WALLET }, { exceptionFiles: [caller] }), []);
});

test("fixture: 型だけの import は数えず、動的 import・副作用 import は数える。生成の一覧(src/registry)は数えない", () => {
  const caller = "src/features/core/purchase/services/server/buy.ts";
  assert.deepEqual(run({ [caller]: 'import type { W } from "@/features/core/wallet/services/server/walletService";\n' }), []);
  assert.deepEqual(run({ [caller]: 'export const load = () => import("@/features/core/wallet/services/server/walletService");\n' }), [`${caller} → core/wallet`]);
  assert.deepEqual(run({ [caller]: 'import "@/features/core/coupon/services/server/couponService";\n' }), [`${caller} → core/coupon`]);
  assert.deepEqual(run({ "src/registry/serviceRegistry.ts": IMPORT_WALLET }), []);
});
