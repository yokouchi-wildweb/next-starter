// scripts/workflow/repo-json/repoJson.test.mjs — pnpm workflow repo-json(set / migrate / 読み手との一致)。一時のフォルダだけに書く
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { readForkIdentity } from "../../../src/lib/forkOwnership/node.mjs";
import { migrate, parseValue, readValues, RepoJsonError, setValue, unsetValue } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const made = [];
after(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** 一時のリポ: project.md(text)と CATALOG の先頭の節 */
const repo = ({ project, first = "next-starter", repoJson } = {}) => {
  const root = mkdtempSync(path.join(tmpdir(), "repo-json-"));
  made.push(root);
  mkdirSync(path.join(root, ".claude/rules"), { recursive: true });
  mkdirSync(path.join(root, "src/lib"), { recursive: true });
  writeFileSync(path.join(root, "src/lib/CATALOG.md"), `# 目録\n\n## ${first}\n`);
  if (project !== undefined) writeFileSync(path.join(root, ".claude/rules/project.md"), project);
  if (repoJson !== undefined) writeFileSync(path.join(root, "repo.json"), repoJson);
  return root;
};
const read = (root, f) => readFileSync(path.join(root, f), "utf8");

test("migrate: 2 行を repo.json へ移して消す。yes = CATALOG の先頭なら root、ほかは middle / none = leaf", () => {
  const tier1 = repo({ project: "# project\n## TIER\nthis_repo: Tier1\nfork_id: next-starter\ndownstream: yes\n- note\n" });
  const r = migrate(tier1);
  assert.deepEqual(r.values, { repo_id: "next-starter", tier: "root" });
  assert.deepEqual(r.removedLines, ["fork_id: next-starter", "downstream: yes"]);
  assert.equal(read(tier1, "repo.json"), '{\n  "repo_id": "next-starter",\n  "tier": "root"\n}\n');
  assert.equal(read(tier1, ".claude/rules/project.md"), "# project\n## TIER\nthis_repo: Tier1\n- note\n");
  assert.deepEqual(readForkIdentity(tier1).errors, []);
  assert.equal(readForkIdentity(tier1).downstream, "yes");
  assert.equal(migrate(repo({ project: "fork_id: oripa-do\ndownstream: yes\n" })).values.tier, "middle");
  assert.equal(migrate(repo({ project: "fork_id: pandora\ndownstream: none  # 末端\n" })).values.tier, "leaf");
});

test("migrate: downstream が無い・読めない = 止める(何も書かない)、--tier で決める。--dry-run は書かない", () => {
  const root = repo({ project: "fork_id: shop\n" });
  assert.throws(() => migrate(root), (e) => e instanceof RepoJsonError && /--tier root\|middle\|leaf/.test(e.message));
  assert.equal(read(root, ".claude/rules/project.md"), "fork_id: shop\n");
  assert.throws(() => migrate(root, { tier: "big" }), /使えない値/);
  const dry = migrate(root, { tier: "leaf", dryRun: true });
  assert.deepEqual(dry.values, { repo_id: "shop", tier: "leaf" });
  assert.equal(read(root, ".claude/rules/project.md"), "fork_id: shop\n");
  migrate(root, { tier: "leaf" });
  assert.equal(read(root, ".claude/rules/project.md"), "");
  assert.deepEqual(readValues(root), { repo_id: "shop", tier: "leaf" });
  // 宣言が無い・形違い
  assert.throws(() => migrate(repo({ project: "# none\n" })), /fork_id: の行が無い/);
  assert.throws(() => migrate(repo({})), /project\.md が無い/);
});

test("set: 点の道の鍵を読み手の決まりで確かめて入れ子の 1 鍵 1 行で書く。ほかの鍵は残す。誤りは書かない", () => {
  const root = repo({ repoJson: '{"tier":"leaf","repo_id":"shop"}' });
  setValue(root, "agent.server", "manual");
  setValue(root, "agent.enabled", "false");
  setValue(root, "agent.entries.deploy", "pnpm deploy:vercel");
  assert.equal(read(root, "repo.json"), '{\n  "repo_id": "shop",\n  "tier": "leaf",\n  "agent": {\n    "enabled": false,\n    "server": "manual",\n    "entries": {\n      "deploy": "pnpm deploy:vercel"\n    }\n  }\n}\n');
  const before = read(root, "repo.json");
  assert.throws(() => setValue(root, "tier", "big"), /使えない値/);
  assert.throws(() => setValue(root, "repo_id", "Bad"), /使えない形/);
  assert.throws(() => setValue(root, "color", "red"), /知らない鍵 color/);
  assert.equal(read(root, "repo.json"), before);
  const fresh = repo({});
  setValue(fresh, "repo_id", "new-one");
  assert.deepEqual(readValues(fresh), { repo_id: "new-one" });
  const broken = repo({ repoJson: "{nope" });
  assert.throws(() => setValue(broken, "tier", "leaf"), /JSON として読めない/);
  assert.equal(parseValue("true"), true);
  assert.equal(parseValue("auto"), "auto");
});

test("unset: 1 つの鍵を消して同じ形で書き直す。無い鍵は何もしない。repo_id・tier・知らない鍵は書かない", () => {
  const root = repo({ repoJson: '{"repo_id":"shop","tier":"leaf","agent":{"peer":"auto","server":"manual"}}' });
  assert.equal(unsetValue(root, "agent.peer").removed, true);
  assert.equal(read(root, "repo.json"), '{\n  "repo_id": "shop",\n  "tier": "leaf",\n  "agent": {\n    "server": "manual"\n  }\n}\n');
  const before = read(root, "repo.json");
  assert.equal(unsetValue(root, "agent.check").removed, false);
  assert.throws(() => unsetValue(root, "tier"), /消せない/);
  assert.throws(() => unsetValue(root, "repo_id"), /消せない/);
  assert.throws(() => unsetValue(root, "color"), /知らない鍵 color/);
  assert.equal(read(root, "repo.json"), before);
});

test("vercel.plan: hobby | pro だけ書ける(組 vercel、agent の後に並ぶ)、unset で消せる", () => {
  const root = repo({ repoJson: '{"repo_id":"shop","tier":"leaf","agent":{"server":"manual"}}' });
  setValue(root, "vercel.plan", "pro");
  assert.equal(read(root, "repo.json"), '{\n  "repo_id": "shop",\n  "tier": "leaf",\n  "agent": {\n    "server": "manual"\n  },\n  "vercel": {\n    "plan": "pro"\n  }\n}\n');
  assert.throws(() => setValue(root, "vercel.plan", "enterprise"), /vercel\.plan の値は hobby \| pro/);
  assert.equal(unsetValue(root, "vercel.plan").removed, true);
  assert.deepEqual(readValues(root), { repo_id: "shop", tier: "leaf", "agent.server": "manual" });
});

test("migrate: 平らな repo.json を入れ子へ(入口の鍵の改名、agent.check・agent.test を落とす)、知らない鍵は止める、2 回目は何も書かない", () => {
  const root = repo({ repoJson: '{"repo_id":"shop","tier":"leaf","vercel.plan":"pro","agent.server":"auto","agent.check":"auto","agent.test":"manual","agent.deploy.entry":"pnpm live:x","agent.deploy.db_entry":"-","agent.db_push.entry":"pnpm db:push"}\n' });
  const r = migrate(root);
  assert.deepEqual(r.dropped, ["agent.check", "agent.test"]);
  assert.deepEqual(r.renamed, ["agent.deploy.entry → agent.entries.deploy", "agent.deploy.db_entry → agent.entries.deploy_db", "agent.db_push.entry → agent.entries.db_push"]);
  assert.equal(r.wrote, true);
  assert.deepEqual(readValues(root), { repo_id: "shop", tier: "leaf", "vercel.plan": "pro", "agent.server": "auto", "agent.entries.deploy": "pnpm live:x", "agent.entries.deploy_db": "-", "agent.entries.db_push": "pnpm db:push" });
  assert.deepEqual(readForkIdentity(root).errors, []);
  const after = read(root, "repo.json");
  assert.equal(migrate(root).wrote, false);
  assert.equal(read(root, "repo.json"), after);
  const unknown = repo({ repoJson: '{"repo_id":"shop","tier":"leaf","agent.server":"auto","color.x":"red"}\n' });
  const before = read(unknown, "repo.json");
  assert.throws(() => migrate(unknown), /知らない鍵 color\.x/);
  assert.equal(read(unknown, "repo.json"), before);
  // 平らな形は set も止める(移してから)
  const flat = repo({ repoJson: '{"repo_id":"shop","tier":"leaf","agent.server":"auto"}' });
  assert.throws(() => setValue(flat, "agent.peer", "auto"), /repo-json migrate/);
});

test("命令: show は誤りで exit 2、get は値、set の誤りは exit 2(1 行)", () => {
  const run = (cwd, ...args) => spawnSync(process.execPath, [path.join(HERE, `${args[0]}.mjs`), ...args.slice(1)], { cwd, encoding: "utf8" });
  const ok = repo({ repoJson: '{"repo_id":"next-starter","tier":"root"}' });
  assert.equal(run(ok, "show").status, 0);
  assert.equal(run(ok, "get", "tier").stdout.trim(), "root");
  assert.equal(run(ok, "get", "agent.x").status, 1);
  const bad = repo({ repoJson: '{"repo_id":"shop","tier":"root"}' });
  const shown = run(bad, "show");
  assert.equal(shown.status, 2);
  assert.match(shown.stdout, /tier root なのに/);
  const refused = run(ok, "set", "tier", "big");
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /^repo-json: /);
});
