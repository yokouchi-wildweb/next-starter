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
  STANDALONE,
  buildPlan,
  countLiveServers,
  formatPlan,
  loadContext,
  mergePolicy,
  parseContext,
  scanItems,
  type Policy,
} from "./lib";

const dirs: string[] = [];
const temp = (prefix: string) => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  dirs.push(dir);
  return dir;
};
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const ALL_AUTO = Object.fromEntries(KIND_NAMES.map((k) => [k, "auto"])) as Policy;

test("種類の表: スキーマの push・本番の指定・確認の埋め込みは、どの種類の打つコマンドにも無い。書く種類は guard を通る入口", () => {
  for (const [name, kind] of Object.entries(KINDS)) {
    assert.doesNotMatch(kind.command ?? "", /db:push|--env|--confirm|production/, name);
  }
  assert.match(KINDS["db-write"].command ?? "", /^pnpm ops db inspect query /);
  assert.match(KINDS["db-delete"].command ?? "", /^pnpm ops db inspect query /);
  assert.deepEqual(KIND_NAMES, ["server", "browser", "login", "db-write", "db-delete", "env-add", "test", "check"]);
});

test("方針: 上流の既定に fork の上書きを種類ごとに重ねる。知らない種類・値・欠けた既定は止める", () => {
  assert.deepEqual(mergePolicy(ALL_AUTO, null), ALL_AUTO);
  const merged = mergePolicy(ALL_AUTO, { "db-write": "manual", "env-add": "off" });
  assert.equal(merged["db-write"], "manual");
  assert.equal(merged["env-add"], "off");
  assert.equal(merged.server, "auto");
  assert.throws(() => mergePolicy(ALL_AUTO, { deploy: "auto" }), /policy\.override\.json: 知らない種類 deploy/);
  assert.throws(() => mergePolicy(ALL_AUTO, { server: "yes" }), /server の値 "yes" は auto \/ manual \/ off/);
  assert.throws(() => mergePolicy(ALL_AUTO, ["server"]), DevcheckError);
  const { check: _omit, ...partial } = ALL_AUTO;
  assert.throws(() => mergePolicy(partial, null), /policy\.default\.json: check がありません/);
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

test("生きている dev-tab の数: 記録があり生きている作業場所だけ数える(読むだけ)", () => {
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
