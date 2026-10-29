// ビルド済み CSS 検査(scripts/styles/builtCss.ts)の純粋ロジックのテスト。
// 実行: pnpm test:built-css
//
// 守りたい契約:
// 1. @theme / @utility の中の変数は検査対象にしない(出力に残る保証が無い)
// 2. 相対 @import だけを辿る(tailwindcss 等のパッケージは辿らない)
// 3. ソースの宣言名が出力に 1 つでも無ければ missing、全てが他ファイルにもある名前なら unverifiable
// 4. 実リポの global.css から辿った結果に、上流の既定値ファイルが宣言数つきで含まれる
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkBuiltCss,
  collectDefinedNames,
  collectRelativeImports,
  resolveImportGraph,
  stripAtRuleBlocks,
} from "./builtCss.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

test("stripAtRuleBlocks: @theme / @utility のブロックを入れ子ごと除き、他は残す", () => {
  const css = `
@theme inline { --color-a: var(--a); @keyframes k { 0% { opacity: 0 } } }
@utility foo { --u: 1; }
@theme-like { --keep-1: 1; }
:root { --keep: 1; }
@import "./x.css";
`;
  const out = stripAtRuleBlocks(css, ["@theme", "@utility"]);
  assert.doesNotMatch(out, /--color-a/);
  assert.doesNotMatch(out, /--u:/);
  assert.match(out, /--keep: 1/);
  assert.match(out, /--keep-1: 1/, "名前の一部が一致するだけの at-rule は除かない");
  assert.match(out, /@import "\.\/x\.css";/);
});

test("collectDefinedNames: 宣言位置の --x: だけを集め、var(--x) やコメントは数えない", () => {
  const css = `
/* --in-comment: 1; */
:root {
  --primary: oklch(0.2 0 0);
  --radius: 0.625rem;
  color: var(--primary);
}
.dark { --primary: oklch(0.9 0 0); }
@media (min-width: 40rem) { :root { --wide: 1; } }
@theme { --animate-x: x 1s; }
`;
  assert.deepEqual(collectDefinedNames(css).sort(), ["--primary", "--radius", "--wide"]);
});

test("collectRelativeImports: 相対パスだけを順序どおりに返す", () => {
  const css = `
@import "tailwindcss";
@import "tw-animate-css";
@import "./a.css";
@import url("./b.css") layer(x);
@import '../c.css';
`;
  assert.deepEqual(collectRelativeImports(css), ["./a.css", "./b.css", "../c.css"]);
});

test("checkBuiltCss: missing / unverifiable / ok を分ける", () => {
  const sources = [
    { file: "a.css", names: ["--primary", "--radius"] },
    { file: "b.css", names: ["--font"] },
    { file: "custom.css", names: ["--primary"] },
    { file: "empty.css", names: [] },
  ];
  const built = ":root{--primary:#111;--radius:.6rem}";
  const report = checkBuiltCss(sources, built);
  assert.deepEqual(report.missing, [{ file: "b.css", names: ["--font"] }]);
  assert.deepEqual(report.unverifiable, ["custom.css"]);
  assert.equal(report.checked, 4);

  const ok = checkBuiltCss(sources, built + ":root{--font:x}");
  assert.deepEqual(ok.missing, []);
});

test("checkBuiltCss: 名前の前方一致で誤って通さない(--primary-foreground は --primary を満たさない)", () => {
  const report = checkBuiltCss([{ file: "a.css", names: ["--primary"] }], ":root{--primary-foreground:#fff}");
  assert.deepEqual(report.missing, [{ file: "a.css", names: ["--primary"] }]);
});

test("resolveImportGraph: 実リポの global.css から上流の既定値ファイルを宣言数つきで辿る", () => {
  const sources = resolveImportGraph(resolve(repoRoot, "src/styles/global.css"), repoRoot);
  const byFile = new Map(sources.map((s) => [s.file, s.names]));
  assert.ok(byFile.has("src/styles/global.css"));
  assert.ok(byFile.get("src/styles/_base/palette.defaults.css").includes("--primary"));
  assert.ok(byFile.get("src/styles/_base/typography.defaults.css").includes("--font-geist-sans"));
  assert.ok(byFile.has("src/styles/_base/index.css"), "_base/index.css を入れ子で辿る");
  assert.ok(byFile.has("src/styles/palette.css"), "fork の palette.css も global.css から辿る");
  assert.ok(!byFile.get("src/styles/_base/animations.css").some((n) => n.startsWith("--animate-")), "@theme 内は対象外");
});
