// fork ID の宣言の読み取りのテスト。実行: pnpm test:fork-ids (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseDownstreamDeclaration, parseForkIdDeclaration, readDeclaredForkIds, readForkIdentity } from "./forkIds.mjs";

test("parseForkIdDeclaration: 行を読み、宣言なし・- ・形違い(大文字・_・. ・-- の連続)は error", () => {
  assert.deepEqual(parseForkIdDeclaration("## TIER\nfork_id: oripa-do\n"), { forkId: "oripa-do", error: null });
  assert.deepEqual(parseForkIdDeclaration("fork_id: next-starter  # Tier1\n"), { forkId: "next-starter", error: null });
  assert.match(parseForkIdDeclaration("this_repo: Tier1\n").error, /行が無い/);
  assert.match(parseForkIdDeclaration("fork_id: -\n").error, /廃止/);
  for (const bad of ["TriQ", "acme_shop", "a.b", "acme--shop", "-x", "x-"]) {
    assert.match(parseForkIdDeclaration(`fork_id: ${bad}\n`).error ?? "", /使えない形/, bad);
  }
  assert.match(parseForkIdDeclaration("fork_id: a\nfork_id: b\n").error, /2 つ以上/);
});

/** project.md・台帳・CATALOG.md を置いた一時リポ */
function repo({ forkId, downstream = "yes", ledgers = [], sections = [] }) {
  const root = mkdtempSync(join(tmpdir(), "fork-ids-"));
  mkdirSync(join(root, ".claude/rules"), { recursive: true });
  mkdirSync(join(root, ".notices/applied"), { recursive: true });
  mkdirSync(join(root, "src/lib"), { recursive: true });
  if (forkId !== undefined) writeFileSync(join(root, ".claude/rules/project.md"), `## TIER\nfork_id: ${forkId}\n${downstream === null ? "" : `downstream: ${downstream}\n`}`);
  for (const name of ledgers) writeFileSync(join(root, `.notices/applied/${name}.md`), "");
  writeFileSync(join(root, "src/lib/CATALOG.md"), `# 目録\n\n${sections.map((n) => `## ${n}\n- src/lib/x — x\n`).join("\n")}`);
  return root;
}

test("readForkIdentity: 自分の名前・祖先(台帳名から自分を除く)・Tier1 = CATALOG の先頭の節", () => {
  assert.deepEqual(readForkIdentity(repo({ forkId: "next-starter", sections: ["next-starter"] })), {
    own: "next-starter",
    ancestors: [],
    isTier1: true,
    downstream: "yes",
    downstreamError: null,
    errors: [],
  });
  assert.deepEqual(readForkIdentity(repo({ forkId: "pandora", downstream: "none", ledgers: ["oripa-do", "pandora"], sections: ["next-starter", "oripa-do", "pandora"] })), {
    own: "pandora",
    ancestors: ["oripa-do"],
    isTier1: false,
    downstream: "none",
    downstreamError: null,
    errors: [],
  });
  assert.deepEqual(readDeclaredForkIds(repo({ forkId: "child", ledgers: ["child", "parent"], sections: ["next-starter"] })), {
    own: "child",
    inherited: ["parent"],
    all: ["child", "parent"],
    errors: [],
  });
});

test("readForkIdentity: 宣言なし・形違いの台帳名・祖先と同名は errors", () => {
  assert.match(readForkIdentity(repo({ sections: ["next-starter"] })).errors.join(), /無い/);
  assert.match(readForkIdentity(repo({ forkId: "acme", ledgers: ["yokouchi-wildweb--triq"], sections: ["next-starter"] })).errors.join(), /台帳名/);
  // Tier1 の名前を名乗る fork(自分の台帳がある)
  const tier1Name = readForkIdentity(repo({ forkId: "next-starter", ledgers: ["next-starter"], sections: ["next-starter"] }));
  assert.match(tier1Name.errors.join(), /Tier1/);
  // 中間 Tier の名前を名乗る
  const middle = readForkIdentity(repo({ forkId: "oripa-do", ledgers: ["oripa-do"], sections: ["next-starter", "oripa-do", "pandora"] }));
  assert.match(middle.errors.join(), /途中の節/);
});

test("parseDownstreamDeclaration: yes / none(行末コメント可)、欠落・2 行・未知値・fork_id: と別の節は error", () => {
  assert.deepEqual(parseDownstreamDeclaration("## TIER\nfork_id: a\ndownstream: yes\n"), { downstream: "yes", error: null });
  assert.deepEqual(parseDownstreamDeclaration("## TIER\nfork_id: a\ndownstream: none  # 末端\n"), { downstream: "none", error: null });
  assert.match(parseDownstreamDeclaration("## TIER\nfork_id: a\n").error, /行が無い/);
  assert.match(parseDownstreamDeclaration("## TIER\nfork_id: a\ndownstream: yes\ndownstream: none\n").error, /2 つ以上/);
  assert.match(parseDownstreamDeclaration("## TIER\nfork_id: a\ndownstream: many derivative projects\n").error, /使えない値/);
  assert.match(parseDownstreamDeclaration("## TIER\nfork_id: a\ndownstream:\n").error, /使えない値/);
  assert.match(parseDownstreamDeclaration("## ROLE\ndownstream: yes\n\n## TIER\nfork_id: a\n").error, /別の節/);
  // 散文の別名(downstream_users:)は宣言に数えない
  assert.deepEqual(parseDownstreamDeclaration("## ROLE\ndownstream_users: many\n## TIER\nfork_id: a\ndownstream: yes\n"), { downstream: "yes", error: null });
});

test("readForkIdentity: downstream: の欠落・未知値は downstreamError(errors には入れない = ビルドは止めない)", () => {
  const missing = readForkIdentity(repo({ forkId: "acme", downstream: null, sections: ["next-starter"] }));
  assert.equal(missing.downstream, null);
  assert.match(missing.downstreamError, /downstream: の行が無い/);
  assert.deepEqual(missing.errors, []);
  const bad = readForkIdentity(repo({ forkId: "acme", downstream: "maybe", sections: ["next-starter"] }));
  assert.match(bad.downstreamError, /使えない値/);
  assert.deepEqual(bad.errors, []);
});
