// scripts/structure/lib-package/libPackage.test.mjs
// 単体用 tsconfig の照合と型検査(指令 23 d3)・sideEffects の検査(d4)。今の repo の lib の検査は門
// pnpm check lib-package だけ(テストで回すと 1 回の --safe で 45 個の型検査が重なる)。
// 実行: pnpm test scripts/structure/lib-package/libPackage.test.mjs
// fixture = 一時フォルダの小さな repo(ルートの tsconfig.json・src/lib/<名前>/・偽の node_modules)。実物の lib には置かない。

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { clearLibPackageCache } from "../../../src/lib/libPackage/node.mjs";
import { checkLibs } from "./check.mjs";
import { findReactInNodeEntry, hasUseClient, runtimeImports } from "./entries.mjs";
import { sideEffectsInSource } from "./sideEffects.mjs";
import { expectedTsconfig } from "./standalone.mjs";

const ROOT_TSCONFIG = {
  compilerOptions: { target: "ES2020", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true, skipLibCheck: true, types: [], paths: { "@/*": ["./src/*"] } },
};

/** files: repo 相対 → 中身(オブジェクトは JSON)。tsconfig: lib 名の一覧 = 期待どおりの tsconfig.json を書く lib */
function withRepo(files, { tsconfig = [] } = {}, fn) {
  const root = mkdtempSync(path.join(tmpdir(), "lib-package-"));
  try {
    const all = {
      "tsconfig.json": ROOT_TSCONFIG,
      "node_modules/fakepkg/package.json": { name: "fakepkg", types: "index.d.ts" },
      "node_modules/fakepkg/index.d.ts": "export declare const pkgValue: number;\n",
      ...files,
    };
    for (const [name, body] of Object.entries(all)) {
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

const codes = (result) => result.problems.map((p) => p.code);
const messages = (result) => result.problems.map((p) => p.message).join("\n");

// b: 宣言済みの lib(入口 1 つ)、c: 宣言していない lib
const B = {
  "src/lib/b/package.json": { exports: { ".": "./index.ts" } },
  "src/lib/b/index.ts": "export const b = 1;\n",
};
const C = { "src/lib/c/index.ts": "export const c = 1;\n", "src/lib/c/x.ts": "export const cx = 1;\n" };
const libA = (code, pkg = {}) => ({
  "src/lib/a/package.json": { exports: { ".": "./index.ts" }, libs: ["b"], ...pkg },
  "src/lib/a/index.ts": code,
});

test("d3: 宣言した lib と外部パッケージを読む lib は通る", () => {
  withRepo({ ...B, ...C, ...libA(`import { b } from "@/lib/b";\nimport { pkgValue } from "fakepkg";\nexport const a = b + pkgValue;\n`) }, { tsconfig: ["a", "b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(result.checked, ["a", "b"]);
    assert.deepEqual(result.problems, []);
  });
});

test("d3: 宣言していない lib を @/lib で読むと型検査で落ちる", () => {
  withRepo({ ...B, ...C, ...libA(`import { c } from "@/lib/c";\nexport const a = c;\n`) }, { tsconfig: ["a", "b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(codes(result), ["diagnostic"]);
    assert.match(messages(result), /src\/lib\/a\/index\.ts:1:\d+ TS2307/);
  });
});

test("d3: lib でない棚(@/hooks)を読むと落ちる", () => {
  withRepo({ ...B, "src/hooks/useX.ts": "export const useX = 1;\n", ...libA(`import { useX } from "@/hooks/useX";\nexport const a = useX;\n`) }, { tsconfig: ["a", "b"] }, (root) => {
    assert.match(messages(checkLibs(root)), /TS2307/);
  });
});

test("d3: 相対パスで宣言の外の lib へ出ると落ちる(paths では止まらない)", () => {
  withRepo({ ...B, ...C, ...libA(`import { cx } from "../c/x";\nexport const a = cx;\n`) }, { tsconfig: ["a", "b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(codes(result), ["escape"]);
    assert.match(messages(result), /"\.\.\/c\/x" が宣言の外 src\/lib\/c\/x\.ts を読みます/);
  });
});

test("d3: peers の components は読める(宣言しなければ落ちる)", () => {
  const files = { ...B, "src/components/Box/index.ts": "export const Box = 1;\n" };
  const code = `import { Box } from "@/components/Box";\nexport const a = Box;\n`;
  withRepo({ ...files, ...libA(code, { peers: ["components"] }) }, { tsconfig: ["a", "b"] }, (root) => {
    assert.deepEqual(checkLibs(root).problems, []);
    assert.deepEqual(expectedTsconfig(root, "a").compilerOptions.paths["@/components/*"], ["../../components/*"]);
  });
  withRepo({ ...files, ...libA(code) }, { tsconfig: ["a", "b"] }, (root) => {
    assert.match(messages(checkLibs(root)), /TS2307/);
  });
});

test("d3: tsconfig.json が無い・行が足りない・余る・他の設定がある → 直す行を名指しで出す(型検査はしない)", () => {
  withRepo({ ...B, ...libA(`export const a = 1;\n`), "src/lib/a/config.ts": "export {};\n" }, { tsconfig: ["b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(codes(result), ["tsconfigMissing", "overrideMissing"]);
    assert.match(messages(result), /src\/lib\/a\/tsconfig\.json: ありません。次の中身で置きます/);
    assert.match(messages(result), /"@lib-config\/a": \[\s*"\.\.\/\.\.\/config\/lib\/a\.config\.ts"/);
  });
  withRepo({ ...B, ...libA(`export const a = 1;\n`) }, { tsconfig: ["b"] }, (root) => {
    const tsconfig = expectedTsconfig(root, "a");
    delete tsconfig.compilerOptions.paths["@/lib/b/*"];
    tsconfig.compilerOptions.paths["@/*"] = ["../../*"];
    tsconfig.compilerOptions.strict = false;
    writeFileSync(path.join(root, "src/lib/a/tsconfig.json"), JSON.stringify(tsconfig));
    const text = messages(checkLibs(root));
    assert.match(text, /paths に "@\/lib\/b\/\*": \["\.\.\/b\/\*"\] を足します/);
    assert.match(text, /paths の "@\/\*" を消します/);
    assert.match(text, /compilerOptions の "strict" は書きません/);
  });
});

test("d3: 閉包: a → b → c なら a の tsconfig.json にも c の行が要る(package.json は直接の依存だけ)", () => {
  const files = {
    "src/lib/c/package.json": { exports: { ".": "./index.ts" } },
    "src/lib/c/index.ts": "export const c = 1;\n",
    "src/lib/b/package.json": { exports: { ".": "./index.ts" }, libs: ["c"] },
    "src/lib/b/index.ts": `import { c } from "@/lib/c";\nexport const b = c;\n`,
    ...libA(`import { b } from "@/lib/b";\nexport const a = b;\n`),
  };
  withRepo(files, { tsconfig: ["a", "b", "c"] }, (root) => {
    assert.deepEqual(Object.keys(expectedTsconfig(root, "a").compilerOptions.paths), ["@/lib/b", "@/lib/b/*", "@/lib/c", "@/lib/c/*"]);
    assert.deepEqual(checkLibs(root).problems, []);
  });
});

test("JS(.mjs)を持つ lib: tsconfig に allowJs・allowImportingTsExtensions・checkJs と JS の include。.mjs も型検査し、.ts だけの lib の形は変わらない", () => {
  const files = {
    ...B,
    "src/lib/j/package.json": { exports: { ".": "./index.mjs" } },
    "src/lib/j/index.mjs": "/** @param {string} s */\nexport const up = (s) => s.toUpperCase();\n",
    // node で走る .mjs のテストは .ts を拡張子つきで読む
    "src/lib/j/helper.ts": "export const h: number = 1;\n",
    "src/lib/j/j.test.mjs": `import { h } from "./helper.ts";\nimport { up } from "./index.mjs";\nexport const v = [up("a"), h];\n`,
  };
  withRepo(files, { tsconfig: ["b", "j"] }, (root) => {
    assert.deepEqual(expectedTsconfig(root, "b"), { extends: "../../../tsconfig.json", include: ["**/*.ts", "**/*.tsx"] });
    const j = expectedTsconfig(root, "j");
    assert.deepEqual(j.compilerOptions, { allowJs: true, allowImportingTsExtensions: true, checkJs: true });
    assert.deepEqual(j.include, ["**/*.ts", "**/*.tsx", "**/*.mjs", "**/*.js"]);
    assert.deepEqual(checkLibs(root).problems, []);
  });
  // checkJs が効く: .mjs の型の誤り(暗黙の any)で落ちる
  withRepo({ ...files, "src/lib/j/index.mjs": "export const up = (s) => s.toUpperCase();\n" }, { tsconfig: ["b", "j"] }, (root) => {
    assert.match(messages(checkLibs(root)), /src\/lib\/j\/index\.mjs:1:\d+ TS7006/);
  });
  // JS の設定が無い tsconfig(.ts だけの形のまま)は直す行を名指しする
  withRepo(files, { tsconfig: ["b"] }, (root) => {
    writeFileSync(
      path.join(root, "src/lib/j/tsconfig.json"),
      JSON.stringify({ extends: "../../../tsconfig.json", compilerOptions: { paths: { "@lib-config/j": ["../../config/lib/j.config.ts"] } }, include: ["**/*.ts", "**/*.tsx"] }),
    );
    const text = messages(checkLibs(root));
    assert.match(text, /"include" は \["\*\*\/\*\.ts","\*\*\/\*\.tsx","\*\*\/\*\.mjs","\*\*\/\*\.js"\] にします/);
    assert.match(text, /compilerOptions の "checkJs" は true にします/);
    assert.match(text, /compilerOptions の "allowImportingTsExtensions" は true にします/);
  });
});

test("d3: @lib-config/<自分> は設定のファイルがあれば読め、無ければ読んだ時だけ落ちる", () => {
  const files = { ...B, ...libA(`export { a } from "./config";\n`), "src/lib/a/config.ts": `import { config } from "@lib-config/a";\nexport const a = config;\n` };
  withRepo({ ...files, "src/config/lib/a.config.ts": "export const config = 1;\n" }, { tsconfig: ["a", "b"] }, (root) => {
    assert.deepEqual(checkLibs(root).problems, []);
  });
  withRepo(files, { tsconfig: ["a", "b"] }, (root) => {
    assert.match(messages(checkLibs(root)), /TS2307/);
  });
});

test("@lib-config/<自分>.ui は描画専用の config.ui.ts を持つ lib だけが読み、上書き <自分>.ui.config.ts を指す", () => {
  const files = { ...B, ...libA(`export { a } from "./config.ui";\n`), "src/lib/a/config.ui.ts": `import override from "@lib-config/a.ui";\nexport const a = override;\n` };
  withRepo({ ...files, "src/config/lib/a.ui.config.ts": "export default {};\n" }, { tsconfig: ["a", "b"] }, (root) => {
    const paths = expectedTsconfig(root, "a").compilerOptions?.paths ?? {};
    assert.deepEqual(paths["@lib-config/a.ui"], ["../../config/lib/a.ui.config.ts"]);
    assert.equal(paths["@lib-config/a"], undefined);
    assert.deepEqual(checkLibs(root).problems, []);
  });
  // 上書きが無ければ overrideMissing(と読んだ所の TS2307)
  withRepo(files, { tsconfig: ["a", "b"] }, (root) => {
    const result = checkLibs(root);
    assert.ok(codes(result).includes("overrideMissing"));
    assert.match(messages(result), /src\/lib\/a\/config\.ui\.ts があるのに上書き src\/config\/lib\/a\.ui\.config\.ts がありません/);
  });
});

test("@lib-config/<自分> の行は設定 config.ts を持つ lib だけ。無い lib に行があれば消す行を名指しし、無い lib が読めば TS2307", () => {
  withRepo({ ...B, ...libA(`export const a = 1;\n`) }, { tsconfig: ["a", "b"] }, (root) => {
    assert.equal(expectedTsconfig(root, "a").compilerOptions?.paths?.["@lib-config/a"], undefined);
    assert.deepEqual(checkLibs(root).problems, []);
    const stale = expectedTsconfig(root, "a");
    stale.compilerOptions.paths["@lib-config/a"] = ["../../config/lib/a.config.ts"];
    writeFileSync(path.join(root, "src/lib/a/tsconfig.json"), JSON.stringify(stale));
    const result = checkLibs(root);
    assert.deepEqual(codes(result), ["pathsExtra"]);
    assert.match(messages(result), /paths の "@lib-config\/a" を消します\(lib にその設定\(config\.ts \/ config\.ui\.ts\)が無い\)/);
  });
  // 依存も設定も無い lib: compilerOptions を書かない。空の compilerOptions / paths が残っていても問題にしない
  withRepo(B, { tsconfig: ["b"] }, (root) => {
    assert.equal(expectedTsconfig(root, "b").compilerOptions, undefined);
    writeFileSync(path.join(root, "src/lib/b/tsconfig.json"), JSON.stringify({ extends: "../../../tsconfig.json", compilerOptions: { paths: {} }, include: ["**/*.ts", "**/*.tsx"] }));
    assert.deepEqual(checkLibs(root).problems, []);
  });
  // config.ts の無い lib が @lib-config を読むと、行が無いので解決できずに落ちる(黙って通らない)
  withRepo({ ...B, ...libA(`import { config } from "@lib-config/a";\nexport const a = config;\n`), "src/config/lib/a.config.ts": "export const config = 1;\n" }, { tsconfig: ["a", "b"] }, (root) => {
    assert.match(messages(checkLibs(root)), /TS2307/);
  });
});

test("package.json の形に問題がある lib は型検査を飛ばし、閉じていない不備 shape 1 つで落ちる(形の中身は lint と形の検査が見る)", () => {
  withRepo({ ...B, ...libA(`export const a = 1;\n`, { name: "a" }) }, { tsconfig: ["b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(result.skipped, ["a"]);
    assert.deepEqual(codes(result), ["shape"]);
  });
});

test("d4: sideEffects:false の lib に css の import があると落ちる", () => {
  withRepo({ ...B, ...libA(`import "./a.css";\nexport const a = 1;\n`, { libs: [], sideEffects: false }), "src/lib/a/a.css": ".a{}\n" }, { tsconfig: ["a", "b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(codes(result), ["sideEffects"]);
    assert.match(messages(result), /src\/lib\/a\/index\.ts:1: 名前を受け取らない import "\.\/a\.css"/);
  });
});

test("d4: sideEffects:false の lib にモジュール直下の登録の呼び出しがあると落ちる", () => {
  const code = `const registry: string[] = [];\nexport function register(x: string) { registry.push(x); }\nregister("a");\n`;
  withRepo({ ...B, ...libA(code, { libs: [], sideEffects: false }) }, { tsconfig: ["a", "b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(codes(result), ["sideEffects"]);
    assert.match(messages(result), /index\.ts:3: モジュール直下の式の文/);
  });
});

test("d4: 宣言だけ(const x = f() を含む)なら sideEffects:false で通る・一覧に載せたファイルの副作用は通る", () => {
  const pure = `const make = () => ({ n: 1 });\nexport const store = make();\nexport type T = number;\nexport default store;\n`;
  withRepo({ ...B, ...libA(pure, { libs: [], sideEffects: false }) }, { tsconfig: ["a", "b"] }, (root) => {
    assert.deepEqual(checkLibs(root).problems, []);
  });
  const files = {
    ...B,
    ...libA(`import "./register";\nexport const a = 1;\n`, { libs: [], sideEffects: ["./index.ts", "register.ts"] }),
    "src/lib/a/register.ts": `globalThis.x = 1;\nexport {};\n`,
  };
  withRepo(files, { tsconfig: ["a", "b"] }, (root) => {
    assert.deepEqual(codes(checkLibs(root)).filter((c) => c === "sideEffects"), []);
  });
});

test("副作用の判定: 直下の文の種類ごと", () => {
  const kinds = (code) => sideEffectsInSource("x.ts", code).map((h) => h.what);
  assert.deepEqual(kinds(`"use client";\n"use strict";\nimport { a } from "./a";\nimport type { B } from "./b";\nexport * from "./c";\nfunction f() { g(); }\nclass K {}\nenum E { A }\n`), []);
  assert.deepEqual(kinds(`import "./side";\nif (x) {}\nfor (;;) {}\ntry {} catch {}\n{ }\nwindow.x = 1;\n`), [
    `名前を受け取らない import "./side"`,
    "モジュール直下のif 文",
    "モジュール直下のfor 文",
    "モジュール直下のtry 文",
    "モジュール直下のブロック",
    "モジュール直下の式の文",
  ]);
  // 先頭でない文字列の文は指示ではない
  assert.deepEqual(kinds(`export const a = 1;\n"use client";\n`), ["モジュール直下の式の文"]);
});

// 入口の名前と中身(D248): 名前は src/lib/libPackage の形の検査(entryName)、中身は entries.mjs
test("入口の名前: 4 つ(. ./server ./client ./node)の lib は通り、ほかの名前の lib は shape で落ちて理由に entryName が出る", () => {
  const four = {
    ...B,
    "src/lib/a/package.json": { exports: { ".": "./index.ts", "./server": "./server.ts", "./client": "./client.ts", "./node": "./node.ts" } },
    "src/lib/a/index.ts": "export const a = 1;\n",
    "src/lib/a/server.ts": "export const s = 1;\n",
    "src/lib/a/client.ts": "export const c = 1;\n",
    "src/lib/a/node.ts": "export const n = 1;\n",
  };
  withRepo(four, { tsconfig: ["a", "b"] }, (root) => {
    assert.deepEqual(checkLibs(root).problems, []);
  });
  const alias = { ...B, "src/lib/a/package.json": { exports: { ".": "./index.ts", "./types": "./types.ts" } }, "src/lib/a/index.ts": "export {};\n", "src/lib/a/types.ts": "export type T = 1;\n" };
  withRepo(alias, { tsconfig: ["b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(result.skipped, ["a"]);
    assert.deepEqual(codes(result), ["shape"]);
    assert.match(messages(result), /entryName: exports の鍵 "\.\/types" は入口の名前ではありません/);
  });
});

test('入口 "." の先頭に "use client" があると entryUseClient で落ちる(部品のファイルの "use client" は通る)', () => {
  const marked = { ...B, ...libA(`"use client";\nexport const a = 1;\n`, { libs: [] }) };
  withRepo(marked, { tsconfig: ["a", "b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(codes(result), ["entryUseClient"]);
    assert.match(messages(result), /src\/lib\/a\/index\.ts: 入口 "\." の先頭に "use client" は書きません/);
  });
  const part = { ...B, ...libA(`export { A } from "./A";\n`, { libs: [] }), "src/lib/a/A.ts": `"use client";\nexport const A = 1;\n` };
  withRepo(part, { tsconfig: ["a", "b"] }, (root) => {
    assert.deepEqual(checkLibs(root).problems, []);
  });
});

test('入口 "./node" から値で辿れるファイルが React・Next を読むと nodeEntryReact で落ち、道を出す', () => {
  const nodeLib = (/** @type {Record<string, string>} */ extra, libs = ["b"]) => ({
    ...B,
    "src/lib/a/package.json": { exports: { ".": "./index.ts", "./node": "./node.ts" }, libs },
    "src/lib/a/index.ts": "export const a = 1;\n",
    ...extra,
  });
  // 中のファイル越しに react
  withRepo(nodeLib({ "src/lib/a/node.ts": `export { n } from "./inner";\n`, "src/lib/a/inner.ts": `import { useState } from "react";\nexport const n = useState;\n` }), {}, (root) => {
    const hit = findReactInNodeEntry(root, "src/lib/a/node.ts");
    assert.deepEqual(hit, { file: "src/lib/a/inner.ts", line: 1, specifier: "react", chain: ["src/lib/a/node.ts", "src/lib/a/inner.ts"] });
    const result = checkLibs(root);
    assert.ok(codes(result).includes("nodeEntryReact"));
    assert.match(messages(result), /src\/lib\/a\/inner\.ts:1: 入口 "\.\/node" から辿れるファイルが "react" を読みます.*道: src\/lib\/a\/node\.ts → src\/lib\/a\/inner\.ts/);
  });
  // 読む lib の入口越しに next/…
  withRepo(nodeLib({ "src/lib/a/node.ts": `export { b } from "@/lib/b";\n`, "src/lib/b/index.ts": `import { headers } from "next/headers";\nexport const b = headers;\n` }), {}, (root) => {
    assert.equal(findReactInNodeEntry(root, "src/lib/a/node.ts")?.specifier, "next/headers");
  });
  // 型だけの import / export と、react を読まない道は通る
  const typeOnly = `import type { ReactNode } from "react";\nimport { type FC } from "react";\nexport type { Props } from "./props";\nexport const n: ReactNode | FC | null = null;\n`;
  withRepo(nodeLib({ "src/lib/a/node.ts": typeOnly, "src/lib/a/props.ts": `import { useState } from "react";\nexport type Props = typeof useState;\n` }), {}, (root) => {
    assert.equal(findReactInNodeEntry(root, "src/lib/a/node.ts"), null);
  });
});

test("runtimeImports / hasUseClient: 実行時に残る指定子と先頭の指示", () => {
  const code = `import a from "x1";\nimport type { B } from "x2";\nimport { type C } from "x3";\nimport { type D, e } from "x4";\nexport * from "x5";\nexport type { F } from "x6";\nconst g = await import("x7");\nconst h = require("x8");\n`;
  assert.deepEqual(runtimeImports(code, "f.ts").map((i) => i.specifier), ["x1", "x4", "x5", "x7", "x8"]);
  assert.equal(hasUseClient(`// c\n"use client";\nexport {};\n`), true);
  assert.equal(hasUseClient(`export {};\n"use client";\n`), false);
});
