// freshOutputs(push の前に生成器を回して生成物の古さを見る)のテスト。生成器は差し替える(一時の git リポ、ネットワーク不要)
// 実行: pnpm test scripts/workflow/notices/freshOutputs.test.mjs
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { git } from "../../../src/lib/forkOwnership/node.mjs";
import { changedPaths, freshOutputs } from "./freshOutputs.mjs";

function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), "fresh-outputs-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "map.jsonl"), "old\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  return dir;
}

test("changedPaths: porcelain の行からパス(改名は先)", () => {
  assert.deepEqual(changedPaths(" M src/a.ts\n?? b.txt\nR  old.md -> new.md\n"), ["src/a.ts", "b.txt", "new.md"]);
});

test("生成器が古い生成物を書き直せば exit 1 で名指す、何も変えなければ 0、作業ツリーが汚れていれば 2", (t) => {
  const dir = repo(t);
  const stale = freshOutputs(dir, { generate: (r) => (writeFileSync(join(r, "map.jsonl"), "new\n"), 0) });
  assert.deepEqual(stale, { code: 1, files: ["map.jsonl"] });
  git(dir, "commit", "-q", "-am", "regenerated");
  assert.deepEqual(freshOutputs(dir, { generate: () => 0 }), { code: 0, files: [] });
  writeFileSync(join(dir, "wip.txt"), "x\n");
  assert.equal(freshOutputs(dir, { generate: () => 0 }).code, 2);
});

test("生成器が落ちたら 2(変わったファイルも添える)", (t) => {
  const dir = repo(t);
  const r = freshOutputs(dir, { generate: (d) => (writeFileSync(join(d, "map.jsonl"), "half\n"), 1) });
  assert.equal(r.code, 2);
  assert.deepEqual(r.files, ["map.jsonl"]);
});
