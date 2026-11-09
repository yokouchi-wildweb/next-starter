// デザイントークンの「構造(theme.css)」と「上流既定値(core/palette.css)」の整合テスト。
// 実行: pnpm test src/styles/core/styleTokens.test.mjs (node:test、追加依存なし)
//
// 守りたい契約:
// 1. theme.css の @theme inline が参照する var(--x) は、上流のどこかの CSS で必ず定義されている
//    (下流の直下のファイルに頼らない = 下流が何も書かなくても動く)
// 2. core/palette.css の .dark は :root に無い変数を持ち込まない(ライトで未定義の変数を作らない)
// 3. core/palette.css は値だけを持つ(@theme や @custom-variant などの構造を含まない)
// 4. core/index.css が upstream の CSS を読み、global.css はそれを最初に、fork の 4 ファイルを後に読む(後勝ちの上書き契約)
//
// 検証対象は src/styles/core/(upstream 所有)。src/styles/ 直下の CSS は下流所有(中身は fork ごとに自由)なので、
// 入口の形と upstream が出荷する中身(コメントだけ)以外は見ない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const stylesDir = dirname(fileURLToPath(import.meta.url));
const entryDir = resolve(stylesDir, "..");
const read = (name) => readFileSync(resolve(stylesDir, name), "utf8");
const readEntry = (name) => readFileSync(resolve(entryDir, name), "utf8");
const importsOf = (css) => [...stripComments(css).matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1]);
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** origin の URL(取得できなければ空文字)。upstream 限定の検査の判定に使う */
function originUrl() {
  try {
    return execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: stylesDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/** 上流所有 CSS(core/ の CSS)の一覧 */
const upstreamCssFiles = readdirSync(stylesDir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => join(stylesDir, f));

/** `--name:` 形式の定義名を全て集める */
function collectDefinitions(css) {
  return new Set([...stripComments(css).matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

/** 指定ブロック(セレクタ)内の定義名を集める */
function collectBlockDefinitions(css, selector) {
  const source = stripComments(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g");
  const names = new Set();
  for (const block of source.matchAll(regex)) {
    for (const m of block[1].matchAll(/--([a-z0-9-]+)\s*:/g)) names.add(m[1]);
  }
  return names;
}

test("theme.css の @theme inline が参照する変数は上流 CSS で全て定義されている", () => {
  const theme = stripComments(read("theme.css"));
  const inlineBlocks = [...theme.matchAll(/@theme\s+inline\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(inlineBlocks.length > 0, "theme.css に @theme inline ブロックが見つからない");

  const referenced = new Set();
  for (const block of inlineBlocks) {
    for (const m of block.matchAll(/var\(--([a-z0-9-]+)\)/g)) referenced.add(m[1]);
  }

  const defined = new Set();
  for (const file of upstreamCssFiles) {
    for (const name of collectDefinitions(readFileSync(file, "utf8"))) defined.add(name);
  }

  const missing = [...referenced].filter((name) => !defined.has(name));
  assert.deepEqual(
    missing,
    [],
    `theme.css が参照しているが上流 CSS(core/)に定義が無い変数: ${missing.join(", ")}。core/palette.css に既定値を追加すること`,
  );
});

test("core/palette.css の .dark は :root に無い変数を持ち込まない", () => {
  const palette = read("palette.css");
  const light = collectBlockDefinitions(palette, ":root");
  const dark = collectBlockDefinitions(palette, ".dark");
  assert.ok(light.size > 0, "core/palette.css に :root の定義が無い");
  const onlyInDark = [...dark].filter((name) => !light.has(name));
  assert.deepEqual(onlyInDark, [], `.dark にしか無い変数: ${onlyInDark.join(", ")}`);
});

test("意味色は 塗り / -foreground / -text の 3 変数で揃っている(片方だけ足した状態を出荷しない)", () => {
  const palette = read("palette.css");
  const theme = stripComments(read("theme.css"));
  for (const name of ["success", "info", "warning", "destructive"]) {
    for (const block of [":root", ".dark"]) {
      const defined = collectBlockDefinitions(palette, block);
      for (const suffix of ["", "-foreground", "-text"]) {
        assert.ok(defined.has(`${name}${suffix}`), `core/palette.css ${block} に --${name}${suffix} が無い`);
        assert.ok(
          theme.includes(`--color-${name}${suffix}: var(--${name}${suffix});`),
          `theme.css に --color-${name}${suffix} の対応付けが無い`,
        );
      }
    }
  }
  for (const name of ["overlay", "overlay-foreground"]) {
    assert.ok(collectBlockDefinitions(palette, ":root").has(name), `core/palette.css に --${name} が無い`);
    assert.ok(theme.includes(`--color-${name}: var(--${name});`), `theme.css に --color-${name} の対応付けが無い`);
  }
});

test("core/palette.css は値だけを持つ(構造は theme.css に置く)", () => {
  const palette = stripComments(read("palette.css"));
  assert.equal(/@theme|@custom-variant|@layer|@import/.test(palette), false);
});

test("書体スタックは core/typography.css が持ち、core/palette.css には無い", () => {
  const typography = collectBlockDefinitions(read("typography.css"), ":root");
  assert.ok(typography.has("font-geist-sans") && typography.has("font-geist-mono"));
  const palette = collectDefinitions(read("palette.css"));
  const fontsInPalette = [...palette].filter((name) => name.startsWith("font-"));
  assert.deepEqual(fontsInPalette, [], `core/palette.css に書体変数がある: ${fontsInPalette.join(", ")}`);
});

test("global.css は core/index.css を最初に、fork の 4 ファイルをその後に読み込む", () => {
  const entry = importsOf(readEntry("global.css"));
  assert.equal(entry[0], "./core/index.css");
  for (const name of ["./palette.css", "./typography.css", "./overrides.css", "./gradient.css"]) {
    assert.ok(entry.indexOf(name) > 0, `global.css が ${name} を core/index.css の後に import していない`);
  }
});

test("core/index.css は tailwindcss を読み、既定値の順序を保つ", () => {
  const imports = importsOf(read("index.css"));
  assert.equal(imports[0], "tailwindcss");
  assert.ok(imports.includes("./palette.css"));
  assert.ok(imports.indexOf("./theme.css") < imports.indexOf("./palette.css"));
  assert.ok(imports.indexOf("./palette.css") < imports.indexOf("./typography.css"));
  assert.ok(imports.includes("./gradient.css"), "core/index.css が上流の既定のグラデーションを読まない");
  const outside = imports.filter((name) => name.startsWith("../"));
  assert.deepEqual(outside, [], "core/index.css は core/ の外を読まない(直下の gradient.css などそのリポの分は global.css が読む)");
});

test("theme.css に色の値が残っていない(値は core/palette.css へ)", () => {
  const theme = stripComments(read("theme.css"));
  const colorValues = [...theme.matchAll(/--[a-z0-9-]+\s*:\s*(oklch|hsl|rgb|#)[^;]*/g)].map((m) => m[0]);
  assert.deepEqual(colorValues, [], `theme.css に色の値が残っている: ${colorValues.join(", ")}`);
});

test("upstream が出荷する直下の palette / typography / overrides / gradient.css はコメントだけ(下流所有ファイルを upstream が埋めない)", () => {
  // 下流 fork ではこの 3 ファイルに値が入るのが正しいので、このテストは upstream リポでのみ意味を持つ。
  // fork 側で失敗させないよう、git remote が upstream 本体のときだけ検査する。
  const isUpstreamRepo = /yokouchi-wildweb\/next-starter(\.git)?$/.test(originUrl());
  if (!isUpstreamRepo) return;
  for (const name of ["palette.css", "typography.css", "overrides.css", "gradient.css"]) {
    const body = stripComments(readEntry(name)).trim();
    assert.match(body, /^$/, `${name} に upstream がコメント以外を書いている`);
  }
  const entry = stripComments(readEntry("global.css")).trim();
  assert.match(entry, /^(@import\s+"\.\/[a-z_/]+\.css";\s*)+$/, "global.css に upstream が @import 以外を書いている");
});
