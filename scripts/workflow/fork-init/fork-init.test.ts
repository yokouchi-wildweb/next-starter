// scripts/workflow/fork-init/fork-init.test.ts — fork の初期化の命令(一時の作り物の親を clone したリポだけに書く。子の処理の命令は記録だけ)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { ForkInitError, TEMPLATE_FILE, applySteps, buildSteps, loadAnswers, planRows, type Runner } from "./lib";

const tmp = mkdtempSync(path.join(tmpdir(), "fork-init-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

// 命令の git(commit)も同じ名で走らせる(手元の git の設定に寄らない)
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" });
const ENV = process.env;
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, env: ENV, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const write = (root: string, file: string, text: string) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
};
const read = (root: string, file: string) => readFileSync(path.join(root, file), "utf8");
let counter = 0;

/** next-starter の形の最小の親を作り clone した直後のリポ(origin = 親) */
function clonedFork() {
  counter += 1;
  const parent = path.join(tmp, `parent-${counter}`);
  mkdirSync(parent);
  git(parent, "init", "-q", "-b", "main");
  write(parent, "repo.json", '{\n  "repo_id": "next-starter",\n  "tier": "root"\n}\n');
  write(parent, "src/lib/CATALOG.md", "# 目録\n\n## next-starter\n- src/lib/crud — CRUD\n");
  write(parent, "package.json", '{\n  "name": "nextjs-app-template",\n  "private": true\n}\n');
  write(parent, ".claude/rules/project.md", "# project\n\n## ROLE\ntype: upstream template\n");
  write(parent, ".claude/rules/behavior.md", "# behavior\n- rule: parent\n");
  write(parent, "src/featureGate/rules/blog.ts", "export const rule = { defaultEnabled: true };\n");
  write(parent, ".gitignore", ".env*\n");
  git(parent, "add", "-A");
  git(parent, "commit", "-q", "-m", "base");
  const fork = path.join(tmp, `fork-${counter}`);
  git(tmp, "clone", "-q", parent, fork);
  return { parent, fork };
}

/** 子の処理の記録。setup env は .env.development を作る(本物と同じく 2 回目は書かない) */
function recorder() {
  const calls: string[] = [];
  const runner: Runner = (command, args, cwd) => {
    calls.push([command, ...args].join(" "));
    if (args.join(" ") === "ops setup env") write(cwd, ".env.development", "APP_ENV=development\n");
  };
  return { calls, runner };
}

const ANSWERS = {
  repo_id: "acme-shop",
  tier: "leaf",
  origin: "git@github.com:acme/acme-shop.git",
  overview: "A shop for acme goods",
  agent: { db_push: "off" },
  features: { blog: false },
  business: { serviceName: "Acme Shop" },
  vercel_plan: "pro",
};

const run = (fork: string, answers: object, runner: Runner) => {
  const input = loadAnswers(fork, JSON.stringify(answers), runner);
  const steps = buildSteps(fork, input, runner, { push: false });
  return { steps, applied: applySteps(fork, steps) };
};

test("apply: D154 の列を書き、behavior.md は親の版のまま、.env はコミットに入れない", () => {
  const { fork } = clonedFork();
  const { calls, runner } = recorder();
  const { applied } = run(fork, ANSWERS, runner);
  assert.deepEqual(applied, ["remotes", "repo-json", "ledger", "catalog", "package-json", "business", "feature:blog", "env", "vercel", "project-md", "commit"]);
  assert.match(git(fork, "remote", "get-url", "upstream"), /parent-/);
  assert.equal(git(fork, "remote", "get-url", "origin"), ANSWERS.origin);
  const repoJson = JSON.parse(read(fork, "repo.json"));
  assert.deepEqual([repoJson.repo_id, repoJson.tier, repoJson["agent.db_push"]], ["acme-shop", "leaf", "off"]);
  assert.match(read(fork, ".notices/applied/acme-shop.md"), new RegExp(`upstream:${git(fork, "rev-parse", "upstream/main")} \\| notes:fork start`));
  assert.match(read(fork, "src/lib/CATALOG.md"), /## next-starter\n- src\/lib\/crud — CRUD\n\n## acme-shop\n$/);
  assert.equal(JSON.parse(read(fork, "package.json")).name, "acme-shop");
  assert.match(read(fork, "src/business/business.ts"), /source: "own"[\s\S]*serviceName: "Acme Shop"/);
  assert.deepEqual(calls, ["node .claude/skills/order/mailbox.mjs name-check acme-shop", "pnpm ops features set blog off", "pnpm ops setup env", "pnpm generate cron -- --plan pro"]);
  const project = read(fork, ".claude/rules/project.md");
  assert.deepEqual(project.match(/^## .+$/gm), ["## overview", "## tier_only", "## maker"]);
  assert.match(project, /- name: acme-shop\n- type: A shop for acme goods\n/);
  assert.match(project, /direct fork of next-starter/);
  assert.equal(read(fork, ".claude/rules/behavior.md"), "# behavior\n- rule: parent\n");
  assert.equal(git(fork, "log", "-1", "--format=%s"), "chore: acme-shop フォーク初期設定");
  assert.equal(git(fork, "status", "--porcelain"), "");
  assert.doesNotMatch(git(fork, "show", "--name-only", "--format="), /\.env/);
});

test("何度でも同じ: 2 回目は書く手順 0・commit なし(走らせる命令は同じ値で走るだけ)", () => {
  const { fork } = clonedFork();
  run(fork, ANSWERS, recorder().runner);
  const head = git(fork, "rev-parse", "HEAD");
  const second = recorder();
  const { steps, applied } = run(fork, ANSWERS, second.runner);
  assert.deepEqual(planRows(fork, steps).filter((row) => row.state === "write"), []);
  assert.deepEqual(applied, ["feature:blog", "vercel"]);
  assert.equal(git(fork, "rev-parse", "HEAD"), head);
});

test("途中で止まった後の 2 回目は残りだけ書く", () => {
  const { fork } = clonedFork();
  const failing: Runner = (command, args) => {
    if (args[0] === "ops" && args[1] === "features") throw new Error("stopped");
  };
  assert.throws(() => run(fork, ANSWERS, failing), /stopped/);
  assert.equal(JSON.parse(read(fork, "repo.json")).repo_id, "acme-shop");
  const { applied } = run(fork, ANSWERS, recorder().runner);
  assert.deepEqual(applied, ["feature:blog", "env", "vercel", "project-md", "commit"]);
  assert.equal(git(fork, "log", "--oneline").split("\n").length, 2);
});

test("自分の版に書き直した project.md は 2 回目に触らない", () => {
  const { fork } = clonedFork();
  run(fork, ANSWERS, recorder().runner);
  write(fork, ".claude/rules/project.md", "# project\n\n## overview\n- name: edited by hand\n");
  run(fork, ANSWERS, recorder().runner);
  assert.match(read(fork, ".claude/rules/project.md"), /edited by hand/);
});

test("答えの誤りは何も書かず理由を全部出す", () => {
  const { fork } = clonedFork();
  const bad = { repo_id: "Next_Starter", tier: "root", origin: "", overview: " ", agent: { "Bad Key": "x" }, features: { nothere: true }, business: { nope: 1 }, vercel_plan: "free" };
  assert.throws(
    () => loadAnswers(fork, JSON.stringify(bad), recorder().runner),
    (error: unknown) => {
      assert.ok(error instanceof ForkInitError);
      for (const part of ["repo_id", "tier", "origin", "overview", "vercel_plan", "agent の鍵", "機能 nothere", "business.nope"]) assert.match(error.message, new RegExp(part));
      return true;
    },
  );
  assert.equal(git(fork, "status", "--porcelain"), "");
  assert.throws(() => loadAnswers(fork, JSON.stringify({ ...ANSWERS, repo_id: "next-starter" }), recorder().runner), /祖先の名|fork 元の名/);
  const nameClash: Runner = () => {
    throw new Error("exit 1");
  };
  assert.throws(() => loadAnswers(fork, JSON.stringify(ANSWERS), nameClash), /受信箱の名と重なる/);
});

test("雛形は道具の中にあり、見出しは overview / tier_only / maker の 3 つ", () => {
  assert.ok(existsSync(TEMPLATE_FILE));
  assert.doesNotMatch(TEMPLATE_FILE, /\.claude\/rules/);
  assert.deepEqual(readFileSync(TEMPLATE_FILE, "utf8").match(/^## .+$/gm), ["## overview", "## tier_only", "## maker"]);
});
