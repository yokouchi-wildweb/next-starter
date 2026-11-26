// scripts/structure/lib-package/jsdoc.test.mjs
// 動き jsdoc: JS の lib の暗黙の any に推した型を JSDoc で書く(既定 dry-run・--apply で書く・字下げを保つ・any / never[] の一覧・tsconfig の食い違う lib は飛ばす)。
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

test("複数行の JSDoc は字下げを保つ(入れ子の関数でも)", () => {
  const files = { ...LIB_A, "src/lib/a/index.mjs": `export function wrap() {\n  function count(items, size) {\n    return items.length + size.toFixed(0).length;\n  }\n  return count("ab", 1);\n}\n` };
  withRepo(files, { tsconfig: ["a"] }, (root) => {
    const text = planLib(root, "a").files[0].text;
    assert.match(text, /\n  \/\*\*\n   \* @param \{[^}\n]+\} items\n   \* @param \{number\} size\n   \*\/\n  function count/);
  });
});

test("欄の any も一覧に出す / 空の配列から推した never[] の直しは書かずに一覧に出す", () => {
  const code = `export const pick = (o) => o.kind;\npick({ kind: 1 });\n\n/** @param {never[]} xs */\nconst k = (xs) => xs.length;\nexport function m(items) {\n  return k(items);\n}\n`;
  withRepo({ ...LIB_A, "src/lib/a/index.mjs": code }, { tsconfig: ["a"] }, (root) => {
    const plan = planLib(root, "a");
    const field = plan.anys.find((a) => a.kind === "any");
    assert.ok(field && /kind: any/.test(field.text), JSON.stringify(plan.anys));
    const never = plan.anys.find((a) => a.kind === "never[]");
    assert.ok(never && /書かなかった: .*never\[\]\} items/.test(never.text), JSON.stringify(plan.anys));
    assert.equal(never.line, 6);
    assert.doesNotMatch(plan.files[0].text, /@param \{never\[\]\} items/);
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

test("祖先の lib(目録の自分以外の節)の中は書かない: --lib なしは自分の lib だけ、--lib で祖先を名指せば書かずに exit 2", () => {
  const LIB_B = { "src/lib/b/package.json": { exports: { ".": "./index.mjs" } }, "src/lib/b/index.mjs": LIB_CODE };
  const files = {
    ...LIB_A,
    ...LIB_B,
    "repo.json": '{\n  "repo_id": "child",\n  "tier": "leaf"\n}\n',
    "src/lib/CATALOG.md": "# 目録\n\n## parent\n- src/lib/a — 親の lib\n\n## child\n- src/lib/b — 自分の lib\n",
  };
  withRepo(files, { tsconfig: ["a", "b"] }, (root) => {
    const before = readFileSync(path.join(root, "src/lib/a/index.mjs"), "utf8");
    const refused = out();
    assert.equal(runJsdoc(root, ["--lib", "a", "--apply"], refused), 2);
    assert.match(refused.text(), /祖先の lib a/);
    assert.equal(runJsdoc(root, ["--apply"], out()), 0);
    assert.equal(readFileSync(path.join(root, "src/lib/a/index.mjs"), "utf8"), before);
    assert.match(readFileSync(path.join(root, "src/lib/b/index.mjs"), "utf8"), /@param \{string\} name/);
  });
});
