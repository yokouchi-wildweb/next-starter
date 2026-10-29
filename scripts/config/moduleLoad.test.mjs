// src/config/ui の config のうち部品を re-export するもの(`export { X } from "…"`)を、それぞれ別プロセスで最初に import して
// モジュールの読み込みが落ちないことを確かめる。実行: pnpm test:config-module-load(notice の checkpoint を付ける commit で必ず通す。
// /downreq の checkpoint の規則・.notices/README「上流側の責務」)
//
// 守りたい契約: config が部品を re-export すると、config を最初に読んだとき config → 部品 → hook → config(初期化の途中)の
// 循環になる。hook や部品がモジュールの読み込み時(top-level)に config の値を読むと、初期化前で
// `ReferenceError: Cannot access '…' before initialization` になり、dev server では全ユーザー画面が 500 になる。
// 他の test は config をモックするか別の順序で読むので見逃す。読み込み順はプロセスごとに 1 つなので、ファイルごとに別プロセスにする。
// 経緯: notice 20261028-152652-frame-marks-dims の区切り(efaab219)で useFooterData がこれを起こした(修正 07924f6c)。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_DIR = "src/config/ui";

/** コメントを除いた本文に `export { … } from "…"`(値の re-export。`export type` は除く)があるか */
export function reexportsComponent(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return /^\s*export\s*\{[^}]*\}\s*from\s*["'][^"']+["']/m.test(code);
}

const targets = readdirSync(join(repoRoot, CONFIG_DIR))
  .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
  .filter((name) => reexportsComponent(readFileSync(join(repoRoot, CONFIG_DIR, name), "utf8")))
  .map((name) => `${CONFIG_DIR}/${name}`);

test("reexportsComponent: コメント内と export type は数えない", () => {
  assert.equal(reexportsComponent(`export { UserFooter } from "@/x";`), true);
  assert.equal(reexportsComponent(`/**\n * export { UserFooter } from "@/x";\n */\nexport const A = 1;`), false);
  assert.equal(reexportsComponent(`// export { A } from "./a";\nexport const B = 1;`), false);
  assert.equal(reexportsComponent(`export type { A } from "./a";`), false);
});

test("部品を re-export する config が見つかる(0 件なら検出が壊れている)", () => {
  assert.ok(targets.length > 0, `${CONFIG_DIR} に re-export を持つ config が見つからない`);
});

for (const file of targets) {
  test(`${file} を最初に import しても読み込みが落ちない`, () => {
    const code = `import(${JSON.stringify(resolve(repoRoot, file))}).then(() => process.exit(0), (e) => { console.error(String(e && e.stack || e)); process.exit(1); });`;
    try {
      execFileSync("npx", ["tsx", "--import", "./scripts/test/serverOnlyStub.mjs", "-e", code], { cwd: repoRoot, stdio: "pipe", encoding: "utf8" });
    } catch (error) {
      assert.fail(`${file} の読み込みが落ちた(循環 import で config の値を初期化前に読んでいないか):\n${error.stderr || error.message}`);
    }
  });
}
