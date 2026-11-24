// リポの名前と段(repo.json)・古い形(project.md)の読み取りのテスト。実行: pnpm test src/lib/forkOwnership/forkIds.test.mjs (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatRepoJson, forkIdOfTexts, parseDownstreamDeclaration, parseForkIdDeclaration, parseRepoIdentity, parseRepoJson, readDeclaredForkIds, readForkIdentity } from "./forkIds.mjs";

test("parseForkIdDeclaration: 行を読み、宣言なし・- ・形違い(大文字・_・. ・-- の連続)は error", () => {
  assert.deepEqual(parseForkIdDeclaration("## TIER\nfork_id: oripa-do\n"), { forkId: "oripa-do", error: null });
  assert.deepEqual(parseForkIdDeclaration("fork_id: next-starter  # Tier1\n"), { forkId: "next-starter", error: null });
  assert.match(parseForkIdDeclaration("this_repo: Tier1\n").error ?? "", /行が無い/);
  assert.match(parseForkIdDeclaration("fork_id: -\n").error ?? "", /廃止/);
  for (const bad of ["TriQ", "acme_shop", "a.b", "acme--shop", "-x", "x-"]) {
    assert.match(parseForkIdDeclaration(`fork_id: ${bad}\n`).error ?? "", /使えない形/, bad);
  }
  assert.match(parseForkIdDeclaration("fork_id: a\nfork_id: b\n").error ?? "", /2 つ以上/);
});

/**
 * repo.json・台帳・CATALOG.md を置いた一時リポ(tier: undefined = 段に合わせる / null = 書かない)
 * @param {{ forkId?: string, tier?: string | null, ledgers?: string[], sections?: string[], raw?: string }} options
 */
function repo({ forkId, tier, ledgers = [], sections = [], raw }) {
  const root = mkdtempSync(join(tmpdir(), "fork-ids-"));
  mkdirSync(join(root, ".notices/applied"), { recursive: true });
  mkdirSync(join(root, "src/lib"), { recursive: true });
  const t = tier === undefined ? (sections[0] === forkId ? "root" : "middle") : tier;
  if (raw !== undefined) writeFileSync(join(root, "repo.json"), raw);
  else if (forkId !== undefined) writeFileSync(join(root, "repo.json"), formatRepoJson({ repo_id: forkId, ...(t === null ? {} : { tier: t }) }));
  for (const name of ledgers) writeFileSync(join(root, `.notices/applied/${name}.md`), "");
  writeFileSync(join(root, "src/lib/CATALOG.md"), `# 目録\n\n${sections.map((n) => `## ${n}\n- src/lib/x — x\n`).join("\n")}`);
  return root;
}

test("readForkIdentity: 自分の名前・祖先(台帳名から自分を除く)・Tier1 = CATALOG の先頭の節", () => {
  assert.deepEqual(readForkIdentity(repo({ forkId: "next-starter", sections: ["next-starter"] })), {
    own: "next-starter",
    ancestors: [],
    isTier1: true,
    tier: "root",
    downstream: "yes",
    downstreamError: null,
    errors: [],
  });
  assert.deepEqual(readForkIdentity(repo({ forkId: "pandora", tier: "leaf", ledgers: ["oripa-do", "pandora"], sections: ["next-starter", "oripa-do", "pandora"] })), {
    own: "pandora",
    ancestors: ["oripa-do"],
    isTier1: false,
    tier: "leaf",
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
  assert.match(parseDownstreamDeclaration("## TIER\nfork_id: a\n").error ?? "", /行が無い/);
  assert.match(parseDownstreamDeclaration("## TIER\nfork_id: a\ndownstream: yes\ndownstream: none\n").error ?? "", /2 つ以上/);
  assert.match(parseDownstreamDeclaration("## TIER\nfork_id: a\ndownstream: many derivative projects\n").error ?? "", /使えない値/);
  assert.match(parseDownstreamDeclaration("## TIER\nfork_id: a\ndownstream:\n").error ?? "", /使えない値/);
  assert.match(parseDownstreamDeclaration("## ROLE\ndownstream: yes\n\n## TIER\nfork_id: a\n").error ?? "", /別の節/);
  // 散文の別名(downstream_users:)は宣言に数えない
  assert.deepEqual(parseDownstreamDeclaration("## ROLE\ndownstream_users: many\n## TIER\nfork_id: a\ndownstream: yes\n"), { downstream: "yes", error: null });
});

test("readForkIdentity: tier の欠落 = leaf、知らない値・root と CATALOG の食い違い(両向き)は downstreamError(errors には入れない = ビルドは止めない)", () => {
  const missing = readForkIdentity(repo({ forkId: "acme", tier: null, sections: ["next-starter"] }));
  assert.equal(missing.tier, "leaf");
  assert.equal(missing.downstream, "none");
  assert.equal(missing.downstreamError, null);
  const bad = readForkIdentity(repo({ forkId: "acme", tier: "many", sections: ["next-starter"] }));
  assert.equal(bad.downstream, null);
  assert.match(bad.downstreamError ?? "", /使えない値/);
  assert.deepEqual(bad.errors, []);
  const fakeRoot = readForkIdentity(repo({ forkId: "acme", tier: "root", sections: ["next-starter"] }));
  assert.match(fakeRoot.downstreamError ?? "", /tier root なのに/);
  assert.deepEqual(fakeRoot.errors, []);
  const tier1Leaf = readForkIdentity(repo({ forkId: "next-starter", tier: "leaf", sections: ["next-starter"] }));
  assert.match(tier1Leaf.downstreamError ?? "", /Tier1 は root/);
});

test("repo.json の形: 入れ子(一番上 = repo_id・tier、組 agent(entries は中の組)・vercel)を点の道の表で返し、入れ子の 1 鍵 1 行で書く", () => {
  const nested = '{"repo_id":"a","tier":"leaf","agent":{"server":"auto","enabled":false,"entries":{"deploy":"pnpm live"}},"vercel":{"plan":"pro"}}';
  assert.deepEqual(parseRepoJson(nested), {
    values: { repo_id: "a", tier: "leaf", "agent.server": "auto", "agent.enabled": false, "agent.entries.deploy": "pnpm live", "vercel.plan": "pro" },
    errors: [],
    flat: [],
  });
  assert.match(parseRepoJson('{"repo_id":"a","x":1}').errors.join(), /知らない鍵 x/);
  assert.match(parseRepoJson('{"repo_id":"a","agent":{"server":{"v":1}}}').errors.join(), /文字列か真偽値だけ/);
  assert.match(parseRepoJson('{"repo_id":"a","agent":{"list":["a"]}}').errors.join(), /文字列か真偽値だけ/);
  assert.match(parseRepoJson('{"repo_id":"a","agent":"x"}').errors.join(), /agent は組/);
  assert.match(parseRepoJson('{"repo_id":"a","vercel":{"region":"x"}}').errors.join(), /知らない鍵 vercel\.region/);
  assert.match(parseRepoJson('{"repo_id":"a","tier":3}').errors.join(), /文字列か真偽値だけ/);
  assert.match(parseRepoJson("[1]").errors.join(), /オブジェクトでない/);
  assert.match(parseRepoJson("{nope").errors.join(), /JSON として読めない/);
  // 平らな形 = 移し替えの命令を案内して止める(身元は読む)
  const flat = parseRepoJson('{"repo_id":"a","tier":"leaf","agent.server":"auto","vercel.plan":"pro"}');
  assert.deepEqual(flat.values, { repo_id: "a", tier: "leaf" });
  assert.deepEqual(flat.flat, ["agent.server", "vercel.plan"]);
  assert.match(flat.errors.join(), /pnpm workflow repo-json migrate/);
  assert.match(parseRepoIdentity('{"tier":"leaf"}').error ?? "", /repo_id が無い/);
  assert.match(parseRepoIdentity('{"repo_id":"Bad_Name"}').error ?? "", /使えない形/);
  assert.equal(
    formatRepoJson({ "agent.b": true, "vercel.plan": "pro", tier: "leaf", "agent.entries.deploy": "pnpm live", repo_id: "x", "agent.a": "off" }),
    '{\n  "repo_id": "x",\n  "tier": "leaf",\n  "agent": {\n    "a": "off",\n    "b": true,\n    "entries": {\n      "deploy": "pnpm live"\n    }\n  },\n  "vercel": {\n    "plan": "pro"\n  }\n}\n',
  );
  assert.equal(formatRepoJson({ tier: "leaf", repo_id: "x" }), '{\n  "repo_id": "x",\n  "tier": "leaf"\n}\n');
  // repo.json が読めない・無い・平らな形 = errors
  assert.match(readForkIdentity(repo({ raw: "{bad", sections: ["next-starter"] })).errors.join(), /JSON として読めない/);
  assert.match(readForkIdentity(repo({ sections: ["next-starter"] })).errors.join(), /repo\.json が無い/);
  assert.match(readForkIdentity(repo({ raw: '{"repo_id":"next-starter","tier":"root","agent.server":"auto"}', sections: ["next-starter"] })).errors.join(), /repo-json migrate/);
});

test("forkIdOfTexts: 過去の版は repo.json を先に、無ければ古い形の project.md", () => {
  assert.deepEqual(forkIdOfTexts({ repoJson: '{"repo_id":"mid"}', projectMd: "fork_id: old\n" }), { forkId: "mid", error: null, source: "repo.json" });
  assert.deepEqual(forkIdOfTexts({ repoJson: null, projectMd: "## TIER\nfork_id: old\n" }), { forkId: "old", error: null, source: "project.md" });
  assert.match(forkIdOfTexts({ repoJson: null, projectMd: null }).error ?? "", /どちらも|も無い/);
  assert.equal(forkIdOfTexts({ repoJson: '{"tier":"leaf"}', projectMd: "fork_id: old\n" }).forkId, null);
  // 過去の版の平らな形も名前は読む(平らな形の誤りは数えない)
  assert.deepEqual(forkIdOfTexts({ repoJson: '{"repo_id":"mid","agent.server":"auto"}', projectMd: null }), { forkId: "mid", error: null, source: "repo.json" });
});
