// scripts/runner/test/copyByImports.test.mjs — 一時フォルダへ写す共有の部品(lib.copyByImports.mjs)。一時のフォルダだけに書く
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { copyByImports, importedFiles } from "./lib.copyByImports.mjs";

const made = [];
after(() => made.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
const temp = (name) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `copy-by-imports-${name}-`));
  made.push(d);
  return d;
};
const write = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};

/** 一時のリポ: 入口 → 相対・動的 import・@/ の alias、届かないファイル、データ、外の物、node_modules */
const repo = () => {
  const root = temp("repo");
  write(root, "tsconfig.json", JSON.stringify({ compilerOptions: { module: "esnext", moduleResolution: "bundler", paths: { "@/*": ["./src/*"] } } }));
  write(root, "scripts/tool/run.mjs", 'import { b } from "./b.mjs";\nimport "@/lib/x";\nimport fs from "node:fs";\nimport chalk from "chalk";\nawait import("../shared/c.mjs");\nexport const a = b;\n');
  write(root, "scripts/tool/b.mjs", "export const b = 1;\n");
  write(root, "scripts/tool/unused.mjs", "export const u = 1;\n");
  write(root, "scripts/shared/c.mjs", "export const c = 1;\n");
  write(root, "src/lib/x/index.ts", 'export * from "./y";\n');
  write(root, "src/lib/x/y.ts", "export const y = 1;\n");
  write(root, "src/data/roles/a.json", "{}\n");
  write(root, "src/data/one.txt", "1\n");
  write(root, "node_modules/chalk/index.js", "export default 1;\n");
  write(root, "node_modules/chalk/package.json", JSON.stringify({ name: "chalk", main: "index.js" }));
  return root;
};

test("importedFiles: 入口から相対・動的 import・@/ の alias で届くファイルだけ。届かない物・node_modules・組み込みは無い", async () => {
  const root = repo();
  assert.deepEqual(await importedFiles(root, ["scripts/tool/run.mjs"]), [
    "scripts/shared/c.mjs",
    "scripts/tool/b.mjs",
    "scripts/tool/run.mjs",
    "src/lib/x/index.ts",
    "src/lib/x/y.ts",
  ]);
});

test("copyByImports: コードとデータ(ファイル・フォルダ)を写し、node_modules は symlink、写した道を返す", async () => {
  const from = repo();
  const to = temp("to");
  const copied = await copyByImports({ from, to, entries: ["scripts/tool/run.mjs"], data: ["src/data/roles", "src/data/one.txt"], nodeModules: true });
  assert.deepEqual(copied.sort(), ["scripts/shared/c.mjs", "scripts/tool/b.mjs", "scripts/tool/run.mjs", "src/data/one.txt", "src/data/roles", "src/lib/x/index.ts", "src/lib/x/y.ts"]);
  assert.ok(fs.existsSync(path.join(to, "src/data/roles/a.json")));
  assert.ok(!fs.existsSync(path.join(to, "scripts/tool/unused.mjs")));
  assert.ok(fs.lstatSync(path.join(to, "node_modules")).isSymbolicLink());
});

test("copyByImports: nodeModules が無ければ node_modules を作らない", async () => {
  const from = repo();
  const to = temp("to");
  await copyByImports({ from, to, entries: ["scripts/tool/b.mjs"] });
  assert.ok(fs.existsSync(path.join(to, "scripts/tool/b.mjs")));
  assert.ok(!fs.existsSync(path.join(to, "node_modules")));
});
