// fork ID の宣言の読み取りのテスト。実行: pnpm test:fork-ids (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseForkDotName, parseForkIdDeclaration, readDeclaredForkIds, readForkIdentity } from "./forkIds.mjs";

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
function repo({ forkId, ledgers = [], sections = [] }) {
  const root = mkdtempSync(join(tmpdir(), "fork-ids-"));
  mkdirSync(join(root, ".claude/rules"), { recursive: true });
  mkdirSync(join(root, ".notices/applied"), { recursive: true });
  mkdirSync(join(root, "src/lib"), { recursive: true });
  if (forkId !== undefined) writeFileSync(join(root, ".claude/rules/project.md"), `## TIER\nfork_id: ${forkId}\n`);
  for (const name of ledgers) writeFileSync(join(root, `.notices/applied/${name}.md`), "");
  writeFileSync(join(root, "src/lib/CATALOG.md"), `# 目録\n\n${sections.map((n) => `## ${n}\n- src/lib/x — x\n`).join("\n")}`);
  return root;
}

test("readForkIdentity: 自分の名前・祖先(台帳名から自分を除く)・Tier1 = CATALOG の先頭の節", () => {
  assert.deepEqual(readForkIdentity(repo({ forkId: "next-starter", sections: ["next-starter"] })), {
    own: "next-starter",
    ancestors: [],
    isTier1: true,
    errors: [],
  });
  assert.deepEqual(readForkIdentity(repo({ forkId: "pandora", ledgers: ["oripa-do", "pandora"], sections: ["next-starter", "oripa-do", "pandora"] })), {
    own: "pandora",
    ancestors: ["oripa-do"],
    isTier1: false,
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

test("parseForkDotName: <名前>[.<中置き>].<fork ID>.<拡張子> を読み、印なし・ドット入りの ID・受けない拡張子は null", () => {
  assert.deepEqual(parseForkDotName("playThrottle.acme.ts"), { name: "playThrottle", infix: null, forkId: "acme" });
  assert.deepEqual(parseForkDotName("AppProviders.client.acme.tsx", { infixes: ["client"] }), { name: "AppProviders", infix: "client", forkId: "acme" });
  assert.equal(parseForkDotName("maintenance.ts"), null);
  assert.equal(parseForkDotName("x.a.b.ts"), null);
  assert.equal(parseForkDotName("x.acme.mjs"), null);
  assert.deepEqual(parseForkDotName("x.acme.mjs", { extensions: ["mjs"] })?.forkId, "acme");
  assert.equal(parseForkDotName("1x.acme.ts"), null);
  assert.equal(parseForkDotName("x.Acme.ts"), null, "fork の名前は小文字");
  assert.deepEqual(parseForkDotName("x.oripa-do.ts")?.forkId, "oripa-do");
});
