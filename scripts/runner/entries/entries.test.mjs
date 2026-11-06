// scripts/runner/entries/entries.test.mjs — pnpm workflow / pnpm ops の入口(一時フォルダの fixture)。実行: pnpm test:entries
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { listTargets, run } from "./run.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "entries-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const FILES = {
  "scripts/workflow/tool/go.mjs": 'import { x } from "./lib.mjs";\nconsole.log(x);\n',
  "scripts/workflow/tool/lib.mjs": "export const x = 1;\n",
  "scripts/workflow/tool/go.test.mjs": 'import "./go.mjs";\n',
  "scripts/workflow/tool/README.md": "# tool\n",
  "scripts/workflow/tool/new.ts": 'import { y } from "./lib";\nconsole.log(y);\n',
  "scripts/workflow/tool/lib.ts": "export const y = 1;\n",
  "scripts/workflow/mine/hello.mjs": "console.log('hi');\n",
  "scripts/workflow/mine/hello.test.mjs": 'import "./hello.mjs";\n',
  "scripts/workflow/empty/README.md": "# empty\n",
  "scripts/operations/db/inspect.ts": 'import { p } from "./clear/plan";\n',
  "scripts/operations/db/clear.ts": 'import("./clear/plan");\n',
  "scripts/operations/db/clear/plan.ts": "export const p = 1;\n",
  "scripts/operations/db/clear/plan.test.ts": 'import "./plan";\n',
};

test("一覧: 対象はフォルダ名順(fork が足したフォルダも)、動作は直下のスクリプトから *.test.*・lib.*・下のフォルダの中を除いた物", () => {
  const root = fixture(FILES);
  assert.deepEqual(listTargets(join(root, "scripts/workflow")).map((t) => [t.name, t.actions.map((a) => a.name)]), [["empty", []], ["mine", ["hello"]], ["tool", ["go", "new"]]]);
  assert.deepEqual(listTargets(join(root, "scripts/operations")).map((t) => [t.name, t.actions.map((a) => a.name)]), [["db", ["clear", "inspect"]]]);
});

test("入口: 省けば一覧(exit 0)、.mjs は node・.ts は tsx + server-only の下駄で残りの引数をそのまま渡し、動作の終了コードを返す", () => {
  const root = fixture(FILES);
  const logs = [];
  const calls = [];
  const opts = { repo: root, log: (m) => logs.push(m), spawn: (cmd, args, repo) => (calls.push({ cmd, args, repo }), 3) };
  assert.equal(run(["workflow"], opts), 0);
  assert.match(logs.at(-1), /usage: pnpm workflow <対象> <動作>[\s\S]*tool: go new/);
  assert.equal(run(["operations"], opts), 0);
  assert.match(logs.at(-1), /usage: pnpm ops <対象> <動作>[\s\S]*db: clear inspect/);
  assert.equal(run(["operations", "db"], opts), 0);
  assert.match(logs.at(-1), /usage: pnpm ops db <動作>/);
  assert.equal(run(["workflow", "tool", "go", "--x", "a b"], opts), 3);
  assert.deepEqual(calls.at(-1), { cmd: process.execPath, args: [join(root, "scripts/workflow/tool/go.mjs"), "--x", "a b"], repo: root });
  assert.equal(run(["operations", "--", "db", "inspect", "tables"], opts), 3);
  assert.deepEqual(calls.at(-1), { cmd: "npx", args: ["tsx", "--import", "./scripts/test/serverOnlyStub.mjs", join(root, "scripts/operations/db/inspect.ts"), "tables"], repo: root });
});

test("入口: 知らない種類・対象・動作・部品(lib・テスト・下のフォルダ)の名前は止める(exit 2、動作を起動しない)", () => {
  const root = fixture(FILES);
  const logs = [];
  let spawned = 0;
  const opts = { repo: root, log: (m) => logs.push(m), spawn: () => (spawned++, 0) };
  assert.equal(run([], opts), 2);
  assert.equal(run(["structure"], opts), 2);
  assert.match(logs.at(-1), /種類 structure は知らない/);
  assert.equal(run(["workflow", "nope"], opts), 2);
  assert.match(logs.at(-1), /workflow: 対象 nope が無い/);
  assert.equal(run(["workflow", "tool", "lib"], opts), 2);
  assert.match(logs.at(-1), /動作 lib が無い(.*go, new)/);
  assert.equal(run(["workflow", "tool", "go.test"], opts), 2);
  assert.equal(run(["operations", "db", "plan"], opts), 2);
  assert.match(logs.at(-1), /ops: db に動作 plan が無い/);
  assert.equal(spawned, 0);
});
