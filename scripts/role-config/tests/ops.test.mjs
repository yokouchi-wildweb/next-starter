// role:delete・prof:delete・role:toggle・prof:generate の引数と止まり方の契約テスト（既定は対話なし、-i のときだけ対話）。
// コマンドはスクリプトの置き場からリポジトリのルートを決めるので、一時ディレクトリに要るものを写して、そこで実行する。
// 標準入力は空にして、対話が出ない（待たない）ことも見る。実行: pnpm test:role-config-ops
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const COPY = [
  "scripts/role-config",
  "scripts/domain-config/spec",
  "scripts/domain-config/checks",
  "src/lib/domain/fields",
  "src/utils",
  "src/features/core/user/roles",
  "src/features/core/userProfile",
  "src/features/core/user/extensions",
  "src/registry",
];
let root;
before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "role-ops-"));
  for (const rel of COPY) fs.cpSync(path.join(repoRoot, rel), path.join(root, rel), { recursive: true });
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(root, "node_modules"));
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

const run = (script, ...args) => spawnSync("node", [path.join(root, "scripts/role-config", script), ...args], { cwd: root, encoding: "utf8", input: "", timeout: 20000 });
const rolePath = (file) => path.join(root, "src/features/core/user/roles", file);
const readRole = (file) => JSON.parse(fs.readFileSync(rolePath(file), "utf8"));

test("role:toggle: ID と --on|--off が必須（無い・両方 = 1）、--on / --off は何度回しても同じ結果", () => {
  assert.equal(run("toggleRole.mjs").status, 1);
  const noFlag = run("toggleRole.mjs", "contributor");
  assert.equal(noFlag.status, 1);
  assert.match(noFlag.stderr, /--on か --off/);
  assert.equal(run("toggleRole.mjs", "contributor", "--on", "--off").status, 1);
  assert.equal(run("toggleRole.mjs", "contributor", "--on").status, 0);
  assert.equal(readRole("contributor.role.json").enabled, true);
  assert.equal(run("toggleRole.mjs", "contributor", "--on").status, 0);
  assert.equal(readRole("contributor.role.json").enabled, true);
  assert.equal(run("toggleRole.mjs", "contributor", "--off").status, 0);
  assert.equal(readRole("contributor.role.json").enabled, false);
  assert.equal(run("toggleRole.mjs", "contributor", "--bogus").status, 1);
});

test("prof:generate: ID か --all が必須、見つからない = 1", () => {
  assert.equal(run("generateProfile.mjs").status, 1);
  const missing = run("generateProfile.mjs", "nobody");
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /見つかりません/);
  assert.equal(run("generateProfile.mjs", "contributor", "--all").status, 1);
});

test("role:delete / prof:delete: ID 必須、--confirm が無い・違うなら消さずに 1、一致で消す（JSON は --remove-json のときだけ）", () => {
  for (const script of ["deleteRole.mjs", "deleteProfile.mjs"]) {
    assert.equal(run(script).status, 1, script);
    const missing = run(script, "contributor");
    assert.equal(missing.status, 1, script);
    assert.match(missing.stderr, /--confirm/, script);
    assert.equal(run(script, "contributor", "--confirm", "editor").status, 1, script);
  }
  assert.ok(fs.existsSync(rolePath("contributor.role.json")));
  const registry = path.join(root, "src/features/core/user/extensions/roles.ts");
  assert.match(fs.readFileSync(registry, "utf8"), /contributorRole/);
  assert.equal(run("deleteRole.mjs", "contributor", "--confirm", "contributor").status, 0);
  assert.doesNotMatch(fs.readFileSync(registry, "utf8"), /contributorRole/);
  assert.ok(fs.existsSync(rolePath("contributor.role.json")));
  assert.equal(run("deleteRole.mjs", "editor", "--confirm", "editor", "--remove-json").status, 0);
  assert.equal(fs.existsSync(rolePath("editor.role.json")), false);
  assert.equal(run("deleteRole.mjs", "nobody", "--confirm", "nobody").status, 1);
});
