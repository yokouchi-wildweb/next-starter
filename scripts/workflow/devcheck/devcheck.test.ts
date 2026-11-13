// scripts/workflow/devcheck/devcheck.test.ts — pnpm test scripts/workflow/devcheck
//
// 読むだけの層: 種類の表(スキーマの push・本番が無い)・方針の重ね・fork の項目の走査・文脈ファイル(無い / 良い / 壊れた / 知らない版)・
// 生きている dev-tab の数・計画(片付けが最後・手での種類)と、一時のリポで plan / status を実際に動かした出力。

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import type { DevTabState } from "../dev-tab/lib";
import {
  CLEANUP,
  DevcheckError,
  KINDS,
  KIND_NAMES,
  POLICY_KEYS,
  STANDALONE,
  buildPlan,
  countLiveServers,
  formatPlan,
  loadContext,
  DANGER_NAMES,
  declaredAgentKeys,
  loadPolicy,
  policyKeyOf,
  policyOfValues,
  readAgentPolicy,
  parseContext,
  scanItems,
  type Policy,
} from "./lib";
import { policyRefusal } from "./lib.run";

const dirs: string[] = [];
const temp = (prefix: string) => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  dirs.push(dir);
  return dir;
};
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const ALL_AUTO = { ...Object.fromEntries(POLICY_KEYS.map((k) => [k, "auto"])), db_push: "off", env_production: "off", deploy: "off" } as Policy;

test("種類の表: スキーマの push・本番の指定・確認の埋め込みは、どの種類の打つコマンドにも無い。書く種類は guard を通る入口", () => {
  for (const [name, kind] of Object.entries(KINDS)) {
    assert.doesNotMatch(kind.command ?? "", /db:push|--env|--confirm|production/, name);
  }
  assert.match(KINDS["db-write"].command ?? "", /^pnpm ops db inspect query /);
  assert.match(KINDS["db-delete"].command ?? "", /^pnpm ops db inspect query /);
  assert.deepEqual(KIND_NAMES, ["server", "browser", "login", "db-write", "db-delete", "env-add", "test", "check"]);
});

test("方針: repo.json の agent.* から。無い鍵は既定(通常 auto・危険な 3 つ off)、値の誤り・宣言に無い鍵は止める", () => {
  const defaults = policyOfValues({});
  for (const k of KIND_NAMES) assert.equal(defaults[k], "auto", k);
  assert.equal(defaults.peer, "auto");
  for (const d of DANGER_NAMES) assert.equal(defaults[d], "off", d);
  const p = policyOfValues({ repo_id: "x", "agent.db_write": "manual", "agent.env_add": "off" });
  assert.equal(p["db-write"], "manual");
  assert.equal(p["env-add"], "off");
  assert.equal(p.server, "auto");
  assert.throws(() => policyOfValues({ "agent.deployment": "auto" }), /宣言に無い鍵 agent\.deployment/);
  assert.throws(() => policyOfValues({ "agent.server": "yes" }), /agent\.server の値 "yes" は auto \/ manual \/ off/);
  // 危険な 3 つ: off | manual だけ、auto・知らない値は off
  assert.equal(policyOfValues({ "agent.db_push": "manual" }).db_push, "manual");
  assert.equal(policyOfValues({ "agent.db_push": "auto" }).db_push, "off");
  assert.equal(policyOfValues({ "agent.deploy": "yes" }).deploy, "off");
});

test("方針の入口: 危険な 3 つの入口の既定(db_push = pnpm db:push、deploy = pnpm live と本番の DB の反映、env_production = なし)、fork が差し替える", async () => {
  const dir = temp("devcheck-policy-");
  assert.deepEqual(await loadPolicy(dir), policyOfValues({}));
  const { entries } = await readAgentPolicy(dir);
  assert.deepEqual(entries, {
    db_push: { entry: "pnpm db:push" },
    env_production: { entry: "-" },
    deploy: { entry: "pnpm live", db_entry: "pnpm db:push -- --env production" },
  });
  writeFileSync(path.join(dir, "repo.json"), '{"repo_id": "x", "agent.deploy": "manual", "agent.deploy.entry": "pnpm deploy:vercel"}\n');
  const custom = await readAgentPolicy(dir);
  assert.equal(custom.policy.deploy, "manual");
  assert.equal(custom.entries.deploy.entry, "pnpm deploy:vercel");
  writeFileSync(path.join(dir, "repo.json"), '{"repo_id": "x", "agent.deploy.entry": ""}\n');
  await assert.rejects(readAgentPolicy(dir), /agent\.deploy\.entry は命令の文字列/);
  writeFileSync(path.join(dir, "repo.json"), "{nope");
  await assert.rejects(loadPolicy(dir), /repo\.json: JSON として読めない/);
  // このリポの repo.json(agent.* なし)= 既定
  assert.deepEqual(await loadPolicy(path.join(import.meta.dirname, "../../..")), policyOfValues({}));
  assert.ok(declaredAgentKeys().includes("agent.deploy.db_entry"));
  assert.equal(policyKeyOf("db-write"), "agent.db_write");
});

test("fork の項目: このリポの入口だけを候補にし、知らない種類・外のコマンド・シェルの記号・本番の指定は理由つきで断る", () => {
  const repo = temp("devcheck-items-");
  mkdirSync(path.join(repo, "scripts/workflow/orders"), { recursive: true });
  writeFileSync(path.join(repo, "scripts/workflow/orders/smoke.ts"), "");
  const items = path.join(repo, "items");
  mkdirSync(items);
  const put = (file: string, data: unknown) => writeFileSync(path.join(items, file), typeof data === "string" ? data : JSON.stringify(data));
  put("a-ok-script.json", { name: "orders-test", kind: "test", command: "pnpm test src/features/order", what: "注文のテスト" });
  put("b-ok-workflow.json", { name: "orders-smoke", kind: "check", command: "pnpm workflow orders smoke" });
  put("c-kind.json", { name: "x", kind: "deploy", command: "pnpm test" });
  put("d-foreign.json", { name: "x", kind: "test", command: "npx vitest" });
  put("e-shell.json", { name: "x", kind: "test", command: "pnpm test && rm -rf /" });
  put("f-pipe.json", { name: "x", kind: "test", command: "pnpm test | tee out" });
  put("g-prod.json", { name: "x", kind: "db-write", command: "pnpm ops db inspect query --env production" });
  put("h-missing-action.json", { name: "x", kind: "check", command: "pnpm workflow orders nope" });
  put("i-broken.json", "{ not json");
  put("j-name.json", { name: "Bad Name", kind: "test", command: "pnpm test" });
  const scanned = scanItems(items, repo, { test: "node run.mjs" });
  assert.deepEqual(
    scanned.items.map((i) => [i.name, i.kind, i.command]),
    [
      ["orders-test", "test", "pnpm test src/features/order"],
      ["orders-smoke", "check", "pnpm workflow orders smoke"],
    ],
  );
  assert.deepEqual(
    scanned.rejected.map((r) => r.file),
    ["c-kind.json", "d-foreign.json", "e-shell.json", "f-pipe.json", "g-prod.json", "h-missing-action.json", "i-broken.json", "j-name.json"],
  );
  assert.match(scanned.rejected.find((r) => r.file === "e-shell.json")?.reason ?? "", /シェルの記号/);
  assert.match(scanned.rejected.find((r) => r.file === "g-prod.json")?.reason ?? "", /本番の指定/);
  assert.deepEqual(scanItems(path.join(repo, "none"), repo, {}), { items: [], rejected: [] });
});

test("文脈: 変数が無い = 単体。版つき key=value を読み、無い・知らない版・知らない鍵・悪い値は止める(チームの語の鍵は無い)", () => {
  assert.deepEqual(loadContext({}), STANDALONE);
  assert.deepEqual(loadContext({ DEVCHECK_CONTEXT: "  " }), STANDALONE);
  const dir = temp("devcheck-ctx-");
  const file = path.join(dir, "ctx");
  writeFileSync(file, "# 文脈\nv=1\napproval=auto\nserver=background\ndev_max=3\nworkdir=/w/a\nworkdir=/w/b\n");
  assert.deepEqual(loadContext({ DEVCHECK_CONTEXT: file }), { file, approval: "auto", server: "background", devMax: 3, workdirs: ["/w/a", "/w/b"] });
  assert.throws(() => loadContext({ DEVCHECK_CONTEXT: path.join(dir, "missing") }), /ファイルが読めない/);
  assert.throws(() => loadContext({ DEVCHECK_CONTEXT: "relative/ctx" }), /絶対パス/);
  assert.throws(() => parseContext("approval=auto\n", file), /版 v がない/);
  assert.throws(() => parseContext("v=2\n", file), /知らない版 v=2/);
  assert.throws(() => parseContext("v=1\nteam=council\n", file), /知らない鍵 team/);
  assert.throws(() => parseContext("v=1\napproval=yes\n", file), /approval は each \/ auto/);
  assert.throws(() => parseContext("v=1\ndev_max=0\n", file), /dev_max は 1 以上/);
  assert.throws(() => parseContext("v=1\nworkdir=rel\n", file), /workdir は絶対パス/);
  assert.throws(() => parseContext("v=1\nnot a pair\n", file), /2 行目が key=value でない/);
});

test("方針の全体のスイッチ agent.enabled(D103): false = 全部の種類(peer・危険な 3 つも)が off、無い = true、真偽値でなければ止める", async () => {
  const allOff = policyOfValues({ "agent.enabled": false, "agent.test": "auto", "agent.db_push": "manual" });
  for (const key of POLICY_KEYS) assert.equal(allOff[key], "off", key);
  for (const d of DANGER_NAMES) assert.equal(allOff[d], "off", d);
  assert.equal(policyOfValues({ "agent.enabled": true, "agent.db_write": "manual" })["db-write"], "manual");
  assert.throws(() => policyOfValues({ "agent.enabled": "no" }), /agent\.enabled の値 "no" は true \/ false/);
  // 計画では全部『手で』、run は断る
  const plan = buildPlan({
    checkout: "/repo",
    context: STANDALONE,
    policy: allOff,
    items: [],
    rejected: [],
    state: { server: null, liveServers: 0, admin: { present: false } },
  });
  for (const c of plan.candidates.filter((c) => c.kind !== "cleanup")) assert.equal(c.policy, "off", c.name);
  assert.match(policyRefusal(allOff.server, true, "server") ?? "", /方針で off/);
  assert.match(formatPlan(plan), /危険: db_push=off env_production=off deploy=off/);
  const dir = temp("devcheck-policy-switch-");
  writeFileSync(path.join(dir, "repo.json"), '{"repo_id": "x", "agent.enabled": false}\n');
  assert.equal((await loadPolicy(dir)).peer, "off");
});

test("生きている dev-tab の数:記録があり生きている作業場所だけ数える(読むだけ)", () => {
  const records: Record<string, DevTabState | null> = {
    "/a": { mode: "background", dir: "/a", port: 3000, pid: 1, pgid: 1, procStart: "x", log: "l", command: "c", startedAt: "t" },
    "/b": { mode: "background", dir: "/b", port: 3001, pid: 2, pgid: 2, procStart: "y", log: "l", command: "c", startedAt: "t" },
    "/c": null,
  };
  assert.equal(countLiveServers(["/a", "/b", "/c"], (p) => records[p], (s) => s.dir === "/a"), 1);
});

test("計画: 上流の種類 + fork の項目、最後はいつも片付け。文脈が裏なら server に --background、off は『手で』", () => {
  const facts = {
    checkout: "/repo",
    context: { ...STANDALONE, file: "/ctx", server: "background" as const, devMax: 2 },
    policy: { ...ALL_AUTO, "env-add": "off" as const, "db-write": "manual" as const },
    items: [{ name: "orders-test", kind: "test" as const, command: "pnpm test src/features/order", what: "", file: "a.json" }],
    rejected: [{ file: "e.json", reason: "シェルの記号" }],
    state: { server: null, liveServers: 1, admin: { present: false } },
  };
  const plan = buildPlan(facts);
  assert.deepEqual(plan.candidates.at(-1), CLEANUP);
  assert.equal(plan.candidates.find((c) => c.name === "server")?.command, "pnpm workflow dev-tab run --background");
  assert.equal(plan.candidates.find((c) => c.name === "orders-test")?.source, "fork");
  const text = formatPlan(plan);
  assert.match(text, /env-add \[env-add・手で\]/);
  assert.match(text, /db-write \[db-write・別に確認\]/);
  assert.match(text, /動いている dev-tab: 1 \/ 上限 2/);
  assert.match(text, /断った fork の項目: e\.json\(シェルの記号\)/);
  assert.match(text.split("\n").at(-1) ?? "", /^- cleanup \[cleanup・最後に必ず\]/);
  assert.equal(buildPlan({ ...facts, context: STANDALONE }).candidates.find((c) => c.name === "server")?.command, "pnpm workflow dev-tab run");
});

test("通し: 一時のリポで plan / status を動かす(単体・文脈あり・壊れた文脈は exit 2 で 1 行)", () => {
  const repo = temp("devcheck-run-");
  execFileSync("git", ["init", "-q"], { cwd: repo });
  writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "devcheck-run", private: true, scripts: { test: "node t.js" } }));
  const tsx = path.resolve(import.meta.dirname, "../../../node_modules/.bin/tsx");
  const run = (action: string, extra: Record<string, string> = {}, ...args: string[]) => {
    const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
    delete env.INIT_CWD;
    if (!("DEVCHECK_CONTEXT" in extra)) delete env.DEVCHECK_CONTEXT;
    return spawnSync(tsx, [path.join(import.meta.dirname, `${action}.ts`), ...args], { cwd: repo, env, encoding: "utf8" });
  };
  const plain = run("plan");
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stdout, /^devcheck plan — /);
  assert.match(plain.stdout, /文脈: 単体/);
  assert.match(plain.stdout.trim().split("\n").at(-1) ?? "", /^- cleanup /);
  const json = JSON.parse(run("plan", {}, "--json").stdout);
  assert.equal(json.checkout, repo);
  assert.equal(json.candidates.at(-1).name, "cleanup");
  const ctx = path.join(repo, "ctx");
  writeFileSync(ctx, "v=1\nserver=background\ndev_max=2\n");
  const withCtx = run("status", { DEVCHECK_CONTEXT: ctx });
  assert.equal(withCtx.status, 0, withCtx.stderr);
  assert.match(withCtx.stdout, /動いている dev-tab: 0 \/ 上限 2/);
  writeFileSync(ctx, "v=9\n");
  const broken = run("plan", { DEVCHECK_CONTEXT: ctx });
  assert.equal(broken.status, 2);
  assert.match(broken.stderr, /^✗ DEVCHECK_CONTEXT=.*知らない版 v=9/);
  assert.equal(run("plan", {}, "--bogus").status, 2);
});
