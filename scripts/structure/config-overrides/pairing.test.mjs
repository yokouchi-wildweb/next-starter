// scripts/structure/config-overrides/pairing.test.mjs — 上書きと持ち主の 1 対 1 の検査(設定 D19・D38・D75)を一時フォルダの木で確かめる
// 実行: pnpm test scripts/structure/config-overrides
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkOverridePairs, reportLines } from "./pairing.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const EMPTY = "export default {};\n";
/** 揃った木: core と業務(fork が足した)のドメイン・宣言済みと宣言の無い lib・枠・proxies */
const BASE = {
  "src/features/core/wallet/config.ts": "export const walletConfig = {};\n",
  "src/config/features/wallet.config.ts": EMPTY,
  "src/features/core/wallet/config.ui.ts": "export const walletUi = {};\n",
  "src/config/features/wallet.ui.config.ts": EMPTY,
  "src/features/gacha/config.ts": "export const gachaConfig = {};\n",
  "src/config/features/gacha.config.ts": EMPTY,
  "src/features/core/user/index.ts": "",
  "src/lib/toast/config.ts": "export const toastConfig = {};\n",
  "src/lib/toast/package.json": JSON.stringify({ exports: { ".": "./config.ts" } }),
  "src/config/lib/toast.config.ts": EMPTY,
  "src/lib/plain/config.ts": "export const plainConfig = {};\n",
  "src/config/lib/plain.config.ts": EMPTY,
  "src/app/admin/_layout/config.ts": `export const adminLayoutConfig = { frame: "admin" };\n`,
  "src/config/layout/admin.config.ts": EMPTY,
  "src/proxies/index.ts": "",
  "src/config/features/README.md": "",
  // 古いフォルダと直下のファイルは見ない
  "src/config/app/whatever.config.ts": EMPTY,
  "src/config/ui/user-header.config.ts": EMPTY,
  "src/config/documents/terms.ts": "",
  "src/config/business.config.ts": EMPTY,
};

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "config-overrides-"));
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    if (body === null) continue;
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

const run = (overrides) => checkOverridePairs(tree({ ...BASE, ...overrides }));
const one = (result, pattern) => {
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 1, result.problems.join("\n"));
  assert.match(result.problems[0], pattern);
};

test("揃った木は通る(古いフォルダ app・ui・documents と直下のファイルは見ない、fork が足したドメインも同じに数える)", () => {
  const result = run({});
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
  assert.equal(result.pairs, 6);
  assert.match(reportLines(result)[0], /対 6 組、余り 0・欠落 0/);
});

test("余り: 持ち主の地区が無い上書き(ドメイン・lib・枠・proxies の名前)", () => {
  one(run({ "src/config/features/ghost.config.ts": EMPTY }), /src\/config\/features\/ghost\.config\.ts: 持ち主の無い上書き.*ドメイン ghost が無い/);
  one(run({ "src/config/lib/gone.config.ts": EMPTY }), /src\/config\/lib\/gone\.config\.ts: 持ち主の無い上書き.*lib gone が無い/);
  one(run({ "src/config/layout/user.config.ts": EMPTY }), /src\/config\/layout\/user\.config\.ts: 持ち主の無い上書き.*frame: "user" の宣言が無い/);
  one(run({ "src/config/proxies/redirect.config.ts": EMPTY }), /src\/config\/proxies\/redirect\.config\.ts: 持ち主の無い上書き.*src\/proxies\/redirect\/config\.ts が無い/);
});

test("余り: 持ち主はいるが config.ts が無い上書き", () => {
  one(run({ "src/config/features/user.config.ts": EMPTY }), /src\/config\/features\/user\.config\.ts: 持ち主 src\/features\/core\/user に config\.ts が無い上書き/);
});

test("余り: 種類のフォルダのサブフォルダ・置けない名前", () => {
  one(run({ "src/config/features/nested/a.config.ts": EMPTY }), /src\/config\/features\/nested\/: 種類のフォルダの中は平ら/);
  one(run({ "src/config/features/wallet.ts": EMPTY }), /src\/config\/features\/wallet\.ts: 置けない名前/);
});

test("欠落: features・枠・proxies は config.ts があるのに上書きが無いと落ちる", () => {
  one(run({ "src/config/features/gacha.config.ts": null }), /src\/features\/gacha\/config\.ts: 上書き src\/config\/features\/gacha\.config\.ts が無い/);
  one(run({ "src/config/layout/admin.config.ts": null }), /src\/app\/admin\/_layout\/config\.ts: 上書き src\/config\/layout\/admin\.config\.ts が無い/);
  one(run({ "src/proxies/demo/config.ts": "export const demoConfig = {};\n" }), /src\/proxies\/demo\/config\.ts: 上書き src\/config\/proxies\/demo\.config\.ts が無い/);
});

test("欠落: lib は package.json を宣言した lib なら数えない(pnpm check lib-package の持ち分)、宣言の無い lib は落とす", () => {
  assert.equal(run({ "src/config/lib/toast.config.ts": null }).ok, true);
  one(run({ "src/config/lib/plain.config.ts": null }), /src\/lib\/plain\/config\.ts: 上書き src\/config\/lib\/plain\.config\.ts が無い/);
});

test("描画専用: <名前>.ui.config.ts は持ち主が config.ui.ts を持つときだけ 1 本(片方だけは落ちる)", () => {
  one(run({ "src/config/features/wallet.ui.config.ts": null }), /src\/features\/core\/wallet\/config\.ui\.ts: 描画専用の上書き src\/config\/features\/wallet\.ui\.config\.ts が無い/);
  one(run({ "src/config/features/gacha.ui.config.ts": EMPTY }), /src\/config\/features\/gacha\.ui\.config\.ts: 持ち主 src\/features\/gacha に config\.ui\.ts が無い上書き/);
  one(run({ "src/config/lib/toast.ui.config.ts": EMPTY }), /toast\.ui\.config\.ts: 持ち主 src\/lib\/toast に config\.ui\.ts が無い/);
});

test("基盤の上書き src/config/featureGate/(設定 D91): 持ち主は src/featureGate 固定、平らな <中身の名前>.config.ts、欠落は数えない", () => {
  // 今の上流: フォルダ無し → 通る(門番の議会が switches.config.ts を置く)
  const gate = { "src/featureGate/rules/wallet.ts": "export const rule = {};\n" };
  assert.equal(run(gate).ok, true);
  // 置いたら 1 組として数える(名前は中身の名前、地区の名前と照らさない)
  const placed = run({ ...gate, "src/config/featureGate/switches.config.ts": EMPTY, "src/config/featureGate/README.md": "" });
  assert.deepEqual(placed.problems, []);
  assert.equal(placed.pairs, 7);
  // 持ち主のフォルダが無い・サブフォルダ・置けない名前は余り
  one(run({ "src/config/featureGate/switches.config.ts": EMPTY }), /src\/config\/featureGate\/switches\.config\.ts: 持ち主 src\/featureGate が無い上書き/);
  one(run({ ...gate, "src/config/featureGate/sub/x.config.ts": EMPTY }), /src\/config\/featureGate\/sub\/: 基盤の上書きのフォルダの中は平ら/);
  one(run({ ...gate, "src/config/featureGate/switches.ts": EMPTY }), /src\/config\/featureGate\/switches\.ts: 置けない名前。基盤の上書きは/);
  one(run({ ...gate, "src/config/featureGate/switches.ui.config.ts": EMPTY }), /置けない名前。基盤の上書きは/);
});

test("地区の地図に問題があれば照らさずに落ちる", () => {
  const result = run({ "src/app/(user)/_layout/config.ts": "export const c = {};\n" });
  assert.equal(result.ok, false);
  assert.ok(result.mapProblems.some((p) => /frame: "<枠の名前>" が無い/.test(p)));
  assert.match(reportLines(result)[0], /地区の地図に問題がある/);
});

test("今の木: 余り 0・欠落 0(pnpm check config-overrides)", () => {
  const result = checkOverridePairs(repoRoot);
  assert.deepEqual([...result.mapProblems, ...result.problems], []);
  const out = execFileSync(process.execPath, [join(repoRoot, "scripts/structure/config-overrides/check.mjs")], { encoding: "utf8" });
  assert.match(out, /余り 0・欠落 0/);
});
