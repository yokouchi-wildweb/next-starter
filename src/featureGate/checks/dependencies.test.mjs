// src/featureGate/checks/dependencies.test.mjs
// 依存の検査(D20(b)・L1.12): 閉じられるフォルダ(規則の features)を外から値で import するファイルは、
// (1) 自分のドメインの domainEntry.ts の requires (2) 規則の名前で gate.enabled / gate.assert / useGate().enabled
// (3) その規則で閉じる住所の src/app の下 (4) 同じ規則のフォルダどうし (5) fork の required/<名前> (6) 例外、のどれかでなければ落とす。
// 判定: ./dependencies.mjs。実行: pnpm test:feature-gate
// - 上流の例外は UPSTREAM_DEPENDENCY_EXCEPTIONS(理由つき)、fork の例外は受け口 src/featureGate/dependencyExceptions/<名前>.ts
// - 今の上流の違反は縮む表 UPSTREAM_DEPENDENCY_DEBT(持ち主 = 設定の議会の legate。直った行が表に残ると落ちる)
// - 強さ(L1.13): 区切り gate-s3 から全 Tier で落とす(fork の移行は codemod scripts/codemods/feature-gate-s3.mjs が required/ を書き出す)。
//   縮む表の「直った行」は上流のファイルが前提なので Tier1(src/lib/CATALOG.md の先頭の節が自分 = lint の libOwnership.isRoot と同じ判定)だけで見る

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

import { loadCatalogOwnership } from "../../lib/folderCatalog/catalog.mjs";
import { dependencyExceptions, rules } from "../node.ts";
import { findDependencyViolations } from "./dependencies.mjs";
import { UPSTREAM_DEPENDENCY_DEBT, UPSTREAM_DEPENDENCY_EXCEPTIONS } from "./dependencyDebt.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");

const keyOf = (v) => `${v.file} → ${v.folder}`;

/** Tier1 か(lint の Tier の切り替えと同じ判定)。縮む表の直った行を見るのは Tier1 だけ */
const IS_TIER1 = loadCatalogOwnership({ repoRoot: ROOT, folder: "src/lib" }).isRoot;

/** 実リポの検査の結果: 全 Tier で落とす(gate-s3 から) */
function enforce(problems, message) {
  assert.deepEqual(problems, [], `${message}\n(fork の移行: npx tsx --import ./scripts/test/serverOnlyStub.mjs scripts/codemods/feature-gate-s3.mjs)`);
}

test("実リポ: 閉じられるフォルダを外から読むファイルは 6 つの形のどれか(上流の違反は縮む表、直った行は表から消す)", () => {
  const exceptionFiles = [...Object.keys(UPSTREAM_DEPENDENCY_EXCEPTIONS), ...dependencyExceptions.map((e) => e.file)];
  const violations = findDependencyViolations({ root: ROOT, rules, exceptionFiles });
  const keys = [...new Set(violations.map(keyOf))];
  const unknown = violations.filter((v) => !(keyOf(v) in UPSTREAM_DEPENDENCY_DEBT));
  enforce(
    unknown.map((v) => `${v.file} → ${v.folder}(規則 ${v.rule})`),
    "閉じられる機能を確かめずに読んでいる。domainEntry.ts の requires・gate.enabled(\"<規則>\")・required/<規則>.ts・dependencyExceptions/ のどれかで通す(src/featureGate/README.md「依存の検査」)",
  );
  // 縮む表は上流の物: fork では上流のファイルが変わっていることがあるので Tier1 だけで見る
  if (IS_TIER1) {
    const healed = Object.keys(UPSTREAM_DEPENDENCY_DEBT).filter((key) => !keys.includes(key));
    assert.deepEqual(healed, [], "直った行が UPSTREAM_DEPENDENCY_DEBT に残っている(表から消す)");
  }
});

test("縮む表の各行に持ち主・消す依頼(order)・直し方がある(L1.20)", () => {
  for (const [key, row] of Object.entries(UPSTREAM_DEPENDENCY_DEBT)) {
    for (const field of ["owner", "order", "how"]) assert.ok(typeof row[field] === "string" && row[field].trim().length > 0, `${key}: ${field} が空`);
  }
});

test("実リポ: 例外の行は当たる(縮む表)・理由は空でない", () => {
  const all = { ...UPSTREAM_DEPENDENCY_EXCEPTIONS, ...Object.fromEntries(dependencyExceptions.map((e) => [e.file, e.reason])) };
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
