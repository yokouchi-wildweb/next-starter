// scripts/structure/lib-package/libPackage.test.mjs
// 単体用 tsconfig の照合と型検査(指令 23 d3)・sideEffects の検査(d4)・今の repo で通ること(d5)。
// 実行: pnpm test scripts/structure/lib-package/libPackage.test.mjs
// fixture = 一時フォルダの小さな repo(ルートの tsconfig.json・src/lib/<名前>/・偽の node_modules)。実物の lib には置かない。

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { clearLibPackageCache } from "../../../src/lib/libPackage/index.mjs";
import { checkLibs } from "./check.mjs";
import { sideEffectsInSource } from "./sideEffects.mjs";
import { expectedTsconfig } from "./standalone.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

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
  withRepo({ ...B, ...libA(`export const a = 1;\n`) }, { tsconfig: ["b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(codes(result), ["tsconfigMissing"]);
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
    assert.deepEqual(Object.keys(expectedTsconfig(root, "a").compilerOptions.paths), ["@/lib/b", "@/lib/b/*", "@/lib/c", "@/lib/c/*", "@lib-config/a"]);
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
    assert.deepEqual(expectedTsconfig(root, "b"), {
      extends: "../../../tsconfig.json",
      compilerOptions: { paths: { "@lib-config/b": ["../../config/lib/b.config.ts"] } },
      include: ["**/*.ts", "**/*.tsx"],
    });
    const j = expectedTsconfig(root, "j");
    assert.deepEqual(j.compilerOptions, { allowJs: true, allowImportingTsExtensions: true, checkJs: true, paths: { "@lib-config/j": ["../../config/lib/j.config.ts"] } });
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
  const code = `import { config } from "@lib-config/a";\nexport const a = config;\n`;
  withRepo({ ...B, ...libA(code), "src/config/lib/a.config.ts": "export const config = 1;\n" }, { tsconfig: ["a", "b"] }, (root) => {
    assert.deepEqual(checkLibs(root).problems, []);
  });
  withRepo({ ...B, ...libA(code) }, { tsconfig: ["a", "b"] }, (root) => {
    assert.match(messages(checkLibs(root)), /TS2307/);
  });
});

test("package.json の形に問題がある lib は飛ばす(形は lint と形の検査が見る)", () => {
  withRepo({ ...B, ...libA(`export const a = 1;\n`, { name: "a" }) }, { tsconfig: ["b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(result.skipped, ["a"]);
    assert.deepEqual(result.problems, []);
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
  const code = `"use client";\nconst registry: string[] = [];\nexport function register(x: string) { registry.push(x); }\nregister("a");\n`;
  withRepo({ ...B, ...libA(code, { libs: [], sideEffects: false }) }, { tsconfig: ["a", "b"] }, (root) => {
    const result = checkLibs(root);
    assert.deepEqual(codes(result), ["sideEffects"]);
    assert.match(messages(result), /index\.ts:4: モジュール直下の式の文/);
  });
});

test("d4: 宣言だけ(const x = f() を含む)なら sideEffects:false で通る・一覧に載せたファイルの副作用は通る", () => {
  const pure = `"use client";\nconst make = () => ({ n: 1 });\nexport const store = make();\nexport type T = number;\nexport default store;\n`;
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

test("d5: 今の repo(package.json を持つ lib 0)で問題なし", () => {
  clearLibPackageCache();
  const result = checkLibs(repo);
  assert.deepEqual(result.problems, []);
});
