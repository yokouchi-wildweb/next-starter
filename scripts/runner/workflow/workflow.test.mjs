// scripts/runner/workflow/workflow.test.mjs — pnpm workflow の入口(一時フォルダの fixture)。実行: pnpm test:workflow
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { listTargets, run } from "./run.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "workflow-"));
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
};

test("一覧: 対象はフォルダ名順(fork が足したフォルダも)、動作は直下のスクリプトから *.test.* と lib.* を除いた物", () => {
  const root = fixture(FILES);
  const targets = listTargets(join(root, "scripts/workflow"));
  assert.deepEqual(targets.map((t) => [t.name, t.actions.map((a) => a.name)]), [["empty", []], ["mine", ["hello"]], ["tool", ["go", "new"]]]);
});

test("入口: 省けば一覧(exit 0)、.mjs は node・.ts は tsx で残りの引数をそのまま渡し、動作の終了コードを返す", () => {
  const root = fixture(FILES);
  const logs = [];
  const calls = [];
  const opts = { repo: root, log: (m) => logs.push(m), spawn: (cmd, args, repo) => (calls.push({ cmd, args, repo }), 3) };
  assert.equal(run([], opts), 0);
  assert.match(logs.at(-1), /usage: pnpm workflow <対象> <動作>[\s\S]*tool: go new/);
  assert.equal(run(["tool"], opts), 0);
  assert.match(logs.at(-1), /tool: go new/);
  assert.equal(run(["tool", "go", "--x", "a b"], opts), 3);
  assert.deepEqual(calls.at(-1), { cmd: process.execPath, args: [join(root, "scripts/workflow/tool/go.mjs"), "--x", "a b"], repo: root });
  assert.equal(run(["--", "tool", "new", "feat/x"], opts), 3);
  assert.deepEqual(calls.at(-1), { cmd: "npx", args: ["tsx", join(root, "scripts/workflow/tool/new.ts"), "feat/x"], repo: root });
});

test("入口: 知らない対象・動作・部品(lib・テスト)の名前は止める(exit 2、動作を起動しない)", () => {
  const root = fixture(FILES);
  const logs = [];
  let spawned = 0;
  const opts = { repo: root, log: (m) => logs.push(m), spawn: () => (spawned++, 0) };
  assert.equal(run(["nope"], opts), 2);
  assert.match(logs.at(-1), /対象 nope が無い/);
  assert.equal(run(["tool", "lib"], opts), 2);
  assert.match(logs.at(-1), /動作 lib が無い(.*go, new)/);
  assert.equal(run(["tool", "go.test"], opts), 2);
  assert.equal(spawned, 0);
});
