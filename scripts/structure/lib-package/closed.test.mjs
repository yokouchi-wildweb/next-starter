// scripts/structure/lib-package/closed.test.mjs
// 閉じたかの検査(指令 26 d1): lib ごとの状態、閉じた lib の不備は落とし、宣言の無い lib は数えるだけ。
// 実行: pnpm test scripts/structure/lib-package/closed.test.mjs
// fixture = 一時フォルダの小さな repo(git なし → 全部を歩いて走査)。

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { clearLibPackageCache, listDeclaredLibs, listLibs } from "../../../src/lib/libPackage/index.mjs";
import { checkLibs, libReport } from "./check.mjs";
import { configStateOf, libStates, mergeHelpersOf, scanInnerImports } from "./closed.mjs";
import { expectedTsconfig } from "./standalone.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const ROOT_TSCONFIG = {
  compilerOptions: {
    target: "ES2020",
    module: "esnext",
    moduleResolution: "bundler",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    paths: { "@/*": ["./src/*"], "@lib-config/*": ["./src/config/lib/*.config.ts"] },
  },
};

function withRepo(files, { tsconfig = [] } = {}, fn) {
  const root = mkdtempSync(path.join(tmpdir(), "lib-closed-"));
  try {
    for (const [name, body] of Object.entries({ "tsconfig.json": ROOT_TSCONFIG, ...files })) {
      mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      writeFileSync(path.join(root, name), typeof body === "string" ? body : JSON.stringify(body, null, 2));
    }
    clearLibPackageCache();
    for (const lib of tsconfig) writeFileSync(path.join(root, "src/lib", lib, "tsconfig.json"), JSON.stringify(expectedTsconfig(root, lib), null, 2));
    clearLibPackageCache();
    return fn(root);
  } finally {
    clearLibPackageCache();
    rmSync(root, { recursive: true, force: true });
  }
}

const pkg = (extra = {}) => ({ exports: { ".": "./index.ts" }, ...extra });
const codes = (root) => checkLibs(root).problems.map((p) => p.code);
const row = (root, lib, opts) => libStates(root, opts).find((r) => r.lib === lib);

test("config.ts があるのに上書きが無い閉じた lib は落ち、上書きを置くと通る", () => {
  const files = {
    "src/lib/a/package.json": pkg(),
    "src/lib/a/index.ts": `export { config } from "./config";\n`,
    "src/lib/a/config.ts": `export const config = { n: 1 };\n`,
  };
  withRepo(files, { tsconfig: ["a"] }, (root) => {
    assert.equal(configStateOf(root, "a"), "overrideMissing");
    assert.deepEqual(codes(root), ["overrideMissing"]);
    assert.equal(row(root, "a").state, "gaps");
  });
  withRepo({ ...files, "src/config/lib/a.config.ts": "export default {};\n" }, { tsconfig: ["a"] }, (root) => {
    assert.equal(configStateOf(root, "a"), "ok");
    assert.deepEqual(codes(root), []);
    assert.equal(row(root, "a").state, "closed");
  });
});

test("自前の合成: define<名前>Config・defineConfig.<ext> の define<名前> が残る閉じた lib は落ちる", () => {
  withRepo({ "src/lib/a/package.json": pkg(), "src/lib/a/index.ts": `export function defineAConfig(x = {}) { return { ...x }; }\n` }, { tsconfig: ["a"] }, (root) => {
    assert.deepEqual(mergeHelpersOf(root, "a"), ["defineAConfig"]);
    assert.deepEqual(codes(root), ["mergeHelper"]);
  });
  const viaFile = {
    "src/lib/a/package.json": pkg(),
    "src/lib/a/index.ts": `export { defineAOverrides } from "./defineConfig";\n`,
    "src/lib/a/defineConfig.ts": `export const defineAOverrides = (x = {}) => ({ ...x });\n`,
  };
  withRepo(viaFile, { tsconfig: ["a"] }, (root) => assert.deepEqual(mergeHelpersOf(root, "a"), ["defineAOverrides"]));
});

test("自前の合成でない物: 合成器 defineConfig を読む lib・合成器そのもの・設定でない define<名前>", () => {
  const files = {
    "src/lib/defineConfig/package.json": pkg(),
    "src/lib/defineConfig/index.ts": `export { defineConfig } from "./defineConfig";\n`,
    "src/lib/defineConfig/defineConfig.ts": `export function defineConfig<T>(d: T) { return d; }\n`,
    "src/lib/a/package.json": pkg({ libs: ["defineConfig"] }),
    "src/lib/a/index.ts": `import { defineConfig } from "@/lib/defineConfig";\nexport const defineAConfig = () => defineConfig({ n: 1 });\n`,
    "src/lib/b/package.json": pkg(),
    "src/lib/b/index.ts": `export function defineHiddenColumns(cols: string[]) { return cols; }\n`,
  };
  withRepo(files, { tsconfig: ["defineConfig", "a", "b"] }, (root) => {
    assert.deepEqual(mergeHelpersOf(root, "defineConfig"), []);
    assert.deepEqual(mergeHelpersOf(root, "a"), []);
    assert.deepEqual(mergeHelpersOf(root, "b"), []);
    assert.deepEqual(codes(root), []);
  });
});

test("宣言の無い lib は合成が残っても・上書きが無くても数えて出すだけで落とさない", () => {
  const files = {
    "src/lib/u/index.ts": `export function defineUConfig() { return {}; }\n`,
    "src/lib/u/config.ts": `export const config = {};\n`,
  };
  withRepo(files, {}, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.undeclared, ["u"]);
    const u = row(root, "u");
    assert.equal(u.state, "undeclared");
    assert.equal(u.config, "overrideMissing");
    assert.deepEqual(u.mergeHelpers, ["defineUConfig"]);
  });
});

test("外から中を読む import: 宣言した lib は入口の外、宣言の無い lib は根の外を数える(自分の中・@lib-config・入口は数えない)", () => {
  const files = {
    "src/lib/b/package.json": pkg(),
    "src/lib/b/index.ts": `export * from "./inner";\n`,
    "src/lib/b/inner.ts": `import { x } from "@/lib/b/other";\nexport const inner = x;\n`,
    "src/lib/b/other.ts": `export const x = 1;\n`,
    "src/lib/c/index.ts": `export const c = 1;\n`,
    "src/lib/c/x.ts": `export const cx = 1;\n`,
    "src/app/page.ts": [
      `import { inner } from "@/lib/b/inner";`,
      `import { inner as i2 } from "@/lib/b";`,
      `import { cx } from "@/lib/c/x";`,
      `import { c } from "@/lib/c";`,
      `import cfg from "@lib-config/b";`,
      `export const all = [inner, i2, cx, c, cfg];`,
      `export const lazy = () => import("../lib/c/x");`,
      "",
    ].join("\n"),
  };
  withRepo(files, { tsconfig: ["b"] }, (root) => {
    const hits = scanInnerImports(root);
    assert.deepEqual(hits.get("b"), { count: 1, samples: ["src/app/page.ts → @/lib/b/inner"] });
    assert.deepEqual(hits.get("c"), { count: 2, samples: ["src/app/page.ts → @/lib/c/x", "src/app/page.ts → ../lib/c/x"] });
    assert.equal(row(root, "b", { withInner: true }).innerImports, 1);
    // 外から中を読む import で検査は落とさない(落とすのは pnpm lint の lib-entry)
    assert.ok(!codes(root).includes("innerImport"));
  });
});

test("package.json の形に問題がある lib は skipped で、落とす検査を掛けない", () => {
  withRepo({ "src/lib/a/package.json": pkg({ name: "a" }), "src/lib/a/index.ts": `export function defineAConfig() { return {}; }\n` }, {}, (root) => {
    assert.equal(row(root, "a").state, "skipped");
    assert.deepEqual(checkLibs(root).skipped, ["a"]);
    assert.deepEqual(checkLibs(root).problems, []);
  });
});

test("d1: 今の repo: 宣言した lib はどれも閉じていて不備 0、残りは宣言の無い lib として数える", () => {
  clearLibPackageCache();
  const { rows, summary } = libReport(repo);
  const closed = rows.filter((r) => r.state === "closed").map((r) => r.lib);
  const declared = listDeclaredLibs(repo);
  assert.ok(declared.length > 0, "宣言した lib が 1 本も無い");
  assert.deepEqual(closed.sort(), [...declared].sort());
  assert.equal(summary.gaps, 0);
  assert.equal(summary.problems, 0);
  assert.equal(summary.innerImportsDeclared, 0);
  assert.equal(summary.undeclared, listLibs(repo).length - declared.length);
  // 自前の合成が残る 3 本(L1.23: 閉じる波で defineConfig に寄せる)
  assert.deepEqual(rows.filter((r) => r.mergeHelpers.length > 0).map((r) => r.lib).sort(), ["fonts", "siteTheme", "variantOverrides"]);
});
