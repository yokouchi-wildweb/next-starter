// scripts/structure/lib-package/jsdoc.test.mjs
// 動き jsdoc: JS の lib の暗黙の any に推した型を JSDoc で書く(既定 dry-run・--apply で書く・{any} の一覧・tsconfig の食い違う lib は飛ばす)。
// 実行: pnpm test scripts/structure/lib-package/jsdoc.test.mjs
// fixture = 一時フォルダの小さな repo。

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { clearLibPackageCache } from "../../../src/lib/libPackage/node.mjs";
import { planLib, runJsdoc } from "./jsdoc.mjs";
import { expectedTsconfig } from "./standalone.mjs";

const ROOT_TSCONFIG = {
  compilerOptions: { target: "ES2020", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true, skipLibCheck: true, types: [], paths: { "@/*": ["./src/*"] } },
};

const LIB_CODE = `export function greet(name) {\n  return "hi " + name.toUpperCase();\n}\n\nexport function run() {\n  return greet("a");\n}\n`;

function withRepo(files, { tsconfig = [] } = {}, fn) {
  const root = mkdtempSync(path.join(tmpdir(), "lib-jsdoc-"));
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

const LIB_A = { "src/lib/a/package.json": { exports: { ".": "./index.mjs" } }, "src/lib/a/index.mjs": LIB_CODE };
const out = () => {
  let text = "";
  return { stdout: { write: (s) => (text += s) }, text: () => text };
};

test("dry-run: 暗黙の any に推した型を JSDoc で書く計画を出し、ファイルは書かない", () => {
  withRepo(LIB_A, { tsconfig: ["a"] }, (root) => {
    const plan = planLib(root, "a");
    assert.ok(plan.before > 0, "暗黙の any がある");
    assert.equal(plan.after, 0);
    assert.equal(plan.files.length, 1);
    assert.match(plan.files[0].text, /@param \{string\} name/);
    const io = out();
    assert.equal(runJsdoc(root, ["--lib", "a"], io), 0);
    assert.match(io.text(), /書く\(dry-run/);
    assert.equal(readFileSync(path.join(root, "src/lib/a/index.mjs"), "utf8"), LIB_CODE);
  });
});

test("--apply: lib の中のファイルに書く", () => {
  withRepo(LIB_A, { tsconfig: ["a"] }, (root) => {
    assert.equal(runJsdoc(root, ["--lib", "a", "--apply"], out()), 0);
    assert.match(readFileSync(path.join(root, "src/lib/a/index.mjs"), "utf8"), /@param \{string\} name/);
  });
});

test("推せない所は {any} の一覧に出す", () => {
  const files = { ...LIB_A, "src/lib/a/index.mjs": `export function pass(x) {\n  return x;\n}\n\nexport const y = pass(1) ?? pass("s");\n` };
  withRepo(files, { tsconfig: ["a"] }, (root) => {
    const plan = planLib(root, "a");
    for (const a of plan.anys) assert.match(a.text, /any/);
    assert.ok(plan.anys.every((a) => a.file === "src/lib/a/index.mjs"));
  });
});

test("tsconfig.json が無い・食い違う lib は飛ばして名前を出す。知らない lib・引数は exit 2", () => {
  withRepo(LIB_A, {}, (root) => {
    const io = out();
    assert.equal(runJsdoc(root, [], io), 0);
    assert.match(io.text(), /飛ばした a/);
    assert.equal(runJsdoc(root, ["--lib", "nope"], out()), 2);
    assert.equal(runJsdoc(root, ["--what"], out()), 2);
  });
});
