// src/featureGate/checks/dependencies.test.mjs
// 依存の検査(D20(b)・L1.12): 閉じられるフォルダ(規則の features)を外から値で import するファイルは、
// (1) 自分のドメインの domainEntry.ts の requires (2) 規則の名前で gate.enabled / gate.assert / useGate().enabled
// (3) その規則で閉じる住所の src/app の下 (4) 同じ規則のフォルダどうし (5) fork の required/<名前> (6) 例外、のどれかでなければ落とす。
// 判定: ./dependencies.mjs。実行: pnpm test src/featureGate/checks/dependencies.test.mjs
// - 例外は受け口 src/featureGate/dependencyExceptions/<名前>.ts だけ(上流の項目は 0。上流の違反の縮む表は 0 行になって消した)
// - 強さ(L1.13): 区切り gate-s3 から全 Tier で落とす(fork の移行は codemod .notices/20261105-112509-feature-gate-automation.feature-gate-s3.mjs が required/ を書き出す)

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

import { dependencyExceptions, rules } from "../node.ts";
import { findDependencyViolations } from "./dependencies.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");

const keyOf = (v) => `${v.file} → ${v.folder}`;

/** 実リポの検査の結果: 全 Tier で落とす(gate-s3 から) */
function enforce(problems, message) {
  assert.deepEqual(problems, [], `${message}\n(fork の移行: npx tsx --import ./scripts/runner/preload/serverOnly.mjs .notices/20261105-112509-feature-gate-automation.feature-gate-s3.mjs)`);
}

test("実リポ: 閉じられるフォルダを外から読むファイルは 6 つの形のどれか(違反 0)", () => {
  const exceptionFiles = dependencyExceptions.map((e) => e.file);
  const violations = findDependencyViolations({ root: ROOT, rules, exceptionFiles });
  enforce(
    violations.map((v) => `${v.file} → ${v.folder}(規則 ${v.rule})`),
    "閉じられる機能を確かめずに読んでいる。domainEntry.ts の requires・gate.enabled(\"<規則>\")・required/<規則>.ts・dependencyExceptions/ のどれかで通す(src/featureGate/README.md「依存の検査」)",
  );
});

test("実リポ: 例外の行は当たる(縮む表)・理由は空でない", () => {
  const all = Object.fromEntries(dependencyExceptions.map((e) => [e.file, e.reason]));
  for (const [file, reason] of Object.entries(all)) assert.ok(reason.trim().length > 0, `${file}: reason が空`);
  const without = findDependencyViolations({ root: ROOT, rules, exceptionFiles: [] });
  enforce(
    Object.keys(all).filter((file) => !without.some((v) => v.file === file)),
    "例外が当たらない(行を消す)",
  );
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
  // 名乗りはフォルダ名だけ(目録 D4): 相手の domainEntry のキー(資源の名前)で requires を書いても当たらない
  const walletEntry = { "src/features/core/wallet/services/server/domainEntry.ts": 'export const domainEntries = {\n  wallet: { table: "wallets" },\n  walletLedger: { table: "ledgers" },\n} satisfies X;\n' };
  const requiresOf = (name) => ({ "src/features/core/purchase/services/server/domainEntry.ts": `export const domainEntries = {\n  purchase: { requires: ["${name}"] },\n} satisfies X;\n` });
  assert.deepEqual(run({ [caller]: IMPORT_WALLET, ...walletEntry, ...requiresOf("walletLedger") }), [`${caller} → core/wallet`]);
  assert.deepEqual(run({ [caller]: IMPORT_WALLET, ...walletEntry, ...requiresOf("core/wallet") }), [`${caller} → core/wallet`]);
  assert.deepEqual(run({ [caller]: IMPORT_WALLET, ...walletEntry, ...requiresOf("wallet") }), []);
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

test("fixture: 表を持たない閉じられるフォルダ(Firestore 版など)も、表のあるフォルダと同じに数える", () => {
  // core/chatRoom は pgTable を持たない(domainEntry の table: null)。判定は規則の features だけを見る
  const rules = [...fixtureRules, { name: "chatRoom", features: ["core/chatRoom"], pathPatterns: ["/chat"] }];
  const tableless = {
    "src/features/core/chatRoom/services/server/chatRoomService.ts": "export const chatRoomService = {};\n",
    "src/features/core/chatRoom/services/server/domainEntry.ts": 'export const domainEntries = {\n  chatRoom: { table: null, idColumn: null },\n} satisfies X;\n',
  };
  const IMPORT_CHAT = 'import { chatRoomService } from "@/features/core/chatRoom/services/server/chatRoomService";\nexport const x = chatRoomService;\n';
  const runChat = (files, opts = {}) => findDependencyViolations({ root: fixture({ ...tableless, ...files }), rules, requiredNames: [], ...opts }).map(keyOf);
  const caller = "src/features/core/purchase/services/server/notify.ts";
  assert.deepEqual(runChat({ [caller]: IMPORT_CHAT }), [`${caller} → core/chatRoom`]);
  assert.deepEqual(runChat({ [caller]: IMPORT_CHAT + 'if (!gate.enabled("chatRoom")) throw 0;\n' }), []);
  assert.deepEqual(runChat({ "src/app/(user)/chat/_screen/loader.ts": IMPORT_CHAT }), []);
  assert.deepEqual(runChat({ [caller]: IMPORT_CHAT }, { requiredNames: ["chatRoom"] }), []);
});
