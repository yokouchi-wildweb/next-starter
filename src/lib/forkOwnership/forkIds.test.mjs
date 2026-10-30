// fork ID の宣言の読み取りのテスト。実行: pnpm test:fork-ids (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseForkDotName, parseForkIdDeclaration, readDeclaredForkIds } from "./forkIds.mjs";

test("parseForkIdDeclaration: 行を読み、- と無しは null、不正な形は error", () => {
  assert.deepEqual(parseForkIdDeclaration("## TIER\nfork_id: acme--shop\n"), { forkId: "acme--shop", error: null });
  assert.deepEqual(parseForkIdDeclaration("fork_id: -\n"), { forkId: null, error: null });
  assert.deepEqual(parseForkIdDeclaration("this_repo: Tier1\n"), { forkId: null, error: null });
  assert.equal(parseForkIdDeclaration("fork_id: a.b\n").error?.includes("使えない形"), true);
  assert.equal(parseForkIdDeclaration("fork_id: a\nfork_id: b\n").error?.includes("2 つ以上"), true);
});

test("readDeclaredForkIds: 自分の fork_id: と、台帳名から親の ID を集める", () => {
  const root = mkdtempSync(join(tmpdir(), "fork-ids-"));
  mkdirSync(join(root, ".claude/rules"), { recursive: true });
  mkdirSync(join(root, ".notices/applied"), { recursive: true });
  writeFileSync(join(root, ".claude/rules/project.md"), "## TIER\nfork_id: child\n");
  writeFileSync(join(root, ".notices/applied/child.md"), "");
  writeFileSync(join(root, ".notices/applied/parent.md"), "");
  assert.deepEqual(readDeclaredForkIds(root), { own: "child", inherited: ["parent"], all: ["child", "parent"], errors: [] });
});

test("readDeclaredForkIds: upstream(fork_id: -、台帳なし)は空", () => {
  const root = mkdtempSync(join(tmpdir(), "fork-ids-"));
  mkdirSync(join(root, ".claude/rules"), { recursive: true });
  writeFileSync(join(root, ".claude/rules/project.md"), "fork_id: -\n");
  assert.deepEqual(readDeclaredForkIds(root), { own: null, inherited: [], all: [], errors: [] });
});

test("parseForkDotName: <名前>[.<中置き>].<fork ID>.<拡張子> を読み、印なし・ドット入りの ID・受けない拡張子は null", () => {
  assert.deepEqual(parseForkDotName("playThrottle.acme.ts"), { name: "playThrottle", infix: null, forkId: "acme" });
  assert.deepEqual(parseForkDotName("AppProviders.client.acme.tsx", { infixes: ["client"] }), { name: "AppProviders", infix: "client", forkId: "acme" });
  assert.equal(parseForkDotName("maintenance.ts"), null);
  assert.equal(parseForkDotName("x.a.b.ts"), null);
  assert.equal(parseForkDotName("x.acme.mjs"), null);
  assert.deepEqual(parseForkDotName("x.acme.mjs", { extensions: ["mjs"] })?.forkId, "acme");
  assert.equal(parseForkDotName("1x.acme.ts"), null);
});
