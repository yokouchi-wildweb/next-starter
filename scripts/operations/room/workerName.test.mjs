// roomWorkerName(ルームの Worker の名前 = room-server-<repo_id>)のテスト。一時の dir に repo.json と CATALOG.md を置いて読む
// 実行: pnpm test scripts/operations/room/workerName.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { roomWorkerName, tomlWorkerName } from "./workerName.mjs";

function repo(t, { repoJson, catalog }) {
  const dir = mkdtempSync(join(tmpdir(), "room-worker-name-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  if (repoJson !== undefined) writeFileSync(join(dir, "repo.json"), JSON.stringify(repoJson));
  if (catalog !== undefined) {
    mkdirSync(join(dir, "src/lib"), { recursive: true });
    writeFileSync(join(dir, "src/lib/CATALOG.md"), catalog.map((name) => `## ${name}\n`).join("\n"));
  }
  return dir;
}

test("名前は repo.json の repo_id から(wrangler.toml の name ではない)", (t) => {
  const dir = repo(t, { repoJson: { repo_id: "pandora", tier: "leaf" }, catalog: ["next-starter", "oripa-do", "pandora"] });
  assert.deepEqual(roomWorkerName(dir), { name: "room-server-pandora" });
});

test("repo.json が無い・repo_id が祖先と同じ → 名前を作らない(親の Worker を置き換えない)", (t) => {
  assert.ok(roomWorkerName(repo(t, {})).error);
  const same = repo(t, { repoJson: { repo_id: "oripa-do", tier: "leaf" }, catalog: ["next-starter", "oripa-do", "pandora"] });
  assert.match(roomWorkerName(same).error ?? "", /祖先/);
});

test("tomlWorkerName: name の行を読む、無ければ null", () => {
  assert.equal(tomlWorkerName('main = "src/index.ts"\nname = "room-server-oripa-do"\n'), "room-server-oripa-do");
  assert.equal(tomlWorkerName('main = "src/index.ts"\n'), null);
});
