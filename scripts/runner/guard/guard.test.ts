// scripts/runner/guard/guard.test.ts — pnpm test scripts/runner/guard
// 書く入口の共通の守り: 向き先の選び方・段階の印・同じ DB・継いだ DATABASE_URL・本番の確認・ホストの env・旗の外し方、入口の一覧(全部が守りを呼ぶ)、
// デプロイ(指令 45 の事故の形: 非対話の pnpm live:all)が何も打たずに拒否されること(偽の vercel で確かめる。本物は呼ばない)。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { confirmProduction, type GuardIO, parseGuardFlags, resolveTarget, stageOfFileName } from "./index";
import { roomWillDeploy } from "../../operations/deploy/lib";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const dirs: string[] = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const DEV = "APP_ENV=development\nDATABASE_URL=postgres://u:p@dev.example/app\n";
const PROD = "APP_ENV=production\nDATABASE_URL=postgres://u:p@prod.example/app\n";

function io(files: Record<string, string>, over: Partial<GuardIO> = {}): GuardIO & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    cwd: "/repo",
    env: {},
    isTTY: false,
    readFile: (file) => files[path.basename(file)] ?? null,
    prompt: (q) => (prompts.push(q), ""),
    prompts,
    ...over,
  };
}
const W = { write: true, db: true, what: "書く" };

test("旗: --env <段階> / --env=<段階> / --confirm= を読み、--dry-run と残りは残す。知らない段階は止める", () => {
  assert.deepEqual(parseGuardFlags(["a", "--env", "production", "--dry-run", "--confirm=production", "b"]), { env: "production", confirm: "production", dryRun: true, rest: ["a", "--dry-run", "b"] });
  assert.equal(parseGuardFlags(["--env=staging"]).env, "staging");
  assert.throws(() => parseGuardFlags(["--env", "prod"]), /知らない段階/);
  assert.equal(stageOfFileName(".env.production.local"), "production");
  assert.equal(stageOfFileName(".env"), null);
});

test("既定は開発: .env.development を読み、印が合えば通る(確認なし)", () => {
  const t = resolveTarget([], W, io({ ".env.development": DEV }));
  assert.deepEqual([t.stage, t.envFile, t.values.DATABASE_URL], ["development", ".env.development", "postgres://u:p@dev.example/app"]);
});

test("止める: ファイルが無い・印が無い・知らない値・印とファイル名が違う・ENV_FILE と --env が違う", () => {
  assert.throws(() => resolveTarget([], W, io({})), /\.env\.development がありません/);
  assert.throws(() => resolveTarget([], W, io({ ".env.development": "DATABASE_URL=x\n" })), /段階の印 APP_ENV がありません/);
  assert.throws(() => resolveTarget([], W, io({ ".env.development": "APP_ENV=dev\n" })), /知らない段階/);
  assert.throws(() => resolveTarget([], W, io({ ".env.development": "APP_ENV=production\n" })), /APP_ENV=production がファイル名・向き先の development と違います/);
  assert.throws(() => resolveTarget(["--env", "production"], W, io({ ".env.development": DEV }, { env: { ENV_FILE: ".env.development" } })), /と --env production が違います/);
  assert.throws(() => resolveTarget([], W, io({ ".env.development": DEV }, { env: { APP_ENV: "production" } })), /環境変数 APP_ENV=production/);
});

test(".env.production が無いことは本番を指した時だけ止める", () => {
  assert.doesNotThrow(() => resolveTarget([], W, io({ ".env.development": DEV })));
  assert.throws(() => resolveTarget(["--env", "production"], W, io({ ".env.development": DEV })), /\.env\.production がありません/);
});

test("本番: 開発と同じ DB は止める、本番の DB が空は DB に書く時だけ未設定で止める(同じ DB の判定には掛けない)", () => {
  const same = { ".env.development": DEV, ".env.production": "APP_ENV=production\nDATABASE_URL=postgres://other:pw@dev.example/app\n" };
  assert.throws(() => resolveTarget(["--env", "production", "--confirm=production"], W, io(same)), /同じ DB\(dev\.example\/app\)/);
  const empty = { ".env.development": DEV, ".env.production": "APP_ENV=production\nDATABASE_URL=\n" };
  assert.throws(() => resolveTarget(["--env", "production", "--confirm=production"], W, io(empty)), /本番の DATABASE_URL が空/);
  assert.doesNotThrow(() => resolveTarget(["--env", "production", "--confirm=production"], { write: true, what: "メール" }, io(empty)));
});

test("本番に書く: 非対話は --confirm=production が無ければ拒否、TTY は production と打てば通る、読むだけは確認なし", () => {
  const files = { ".env.development": DEV, ".env.production": PROD };
  assert.throws(() => resolveTarget(["--env", "production"], W, io(files)), /非対話では --confirm=production/);
  assert.equal(resolveTarget(["--env", "production", "--confirm=production"], W, io(files)).stage, "production");
  const tty = io(files, { isTTY: true, prompt: () => "production" });
  assert.equal(resolveTarget(["--env", "production"], W, tty).stage, "production");
  assert.throws(() => resolveTarget(["--env", "production"], W, io(files, { isTTY: true, prompt: () => "yes" })), /確認が取れなかった/);
  assert.equal(resolveTarget(["--env", "production"], { write: false, what: "読む" }, io(files)).stage, "production");
  assert.throws(() => resolveTarget(["--confirm=production"], W, io(files)), /--confirm=production は向き先\(development\)と違います/);
});

test("継いだ DATABASE_URL: 向き先のファイルと同じ DB(host と DB 名)なら通り、別の DB・ファイルが空なら止める(資格情報は出さない)", () => {
  const files = { ".env.development": DEV, ".env.production": PROD };
  const inherit = (url: string, extra: Record<string, string> = {}) => ({ env: { DATABASE_URL: url, ...extra } });
  assert.doesNotThrow(() => resolveTarget([], W, io(files)));
  assert.doesNotThrow(() => resolveTarget([], W, io(files, inherit("postgres://u:p@dev.example/app"))));
  assert.doesNotThrow(() => resolveTarget([], W, io(files, inherit("postgres://other:pw@dev.example/app?sslmode=require"))));
  assert.doesNotThrow(() => resolveTarget([], W, io(files, inherit(""))));
  assert.throws(
    () => resolveTarget([], W, io(files, inherit("postgres://u:secret@prod.example/app"))),
    (e: Error) =>
      /環境変数 DATABASE_URL\(prod\.example\/app\)が向き先 \.env\.development の DATABASE_URL\(dev\.example\/app\)と違います/.test(e.message) && !e.message.includes("secret"),
  );
  assert.throws(
    () => resolveTarget(["--env", "production", "--confirm=production"], W, io(files, inherit("postgres://u:p@dev.example/app"))),
    /環境変数 DATABASE_URL\(dev\.example\/app\)が向き先 \.env\.production の DATABASE_URL\(prod\.example\/app\)と違います/,
  );
  // 本番でも確認より先に止まる(TTY で production と打たせない)
  const tty = io(files, { isTTY: true, prompt: () => "production", env: { DATABASE_URL: "postgres://u:p@dev.example/app" } });
  assert.throws(() => resolveTarget(["--env", "production"], W, tty), /環境変数 DATABASE_URL/);
  assert.deepEqual(tty.prompts, []);
  // ファイルに無い・空の DATABASE_URL に、継いだ値がある = 止める
  assert.throws(() => resolveTarget([], W, io({ ".env.development": "APP_ENV=development\n" }, inherit("postgres://u:p@prod.example/app"))), /DATABASE_URL\(空\)と違います/);
  // 読めない値は資格情報を含みうるので出さない
  assert.throws(() => resolveTarget([], W, io(files, inherit("u:secret-pw"))), (e: Error) => e.message.includes("読めない値") && !e.message.includes("secret"));
  // .local の上書きの後の値と比べる
  const local = { ...files, ".env.development.local": "DATABASE_URL=postgres://me@local/app\n" };
  assert.doesNotThrow(() => resolveTarget([], W, io(local, inherit("postgres://me@local/app"))));
  assert.throws(() => resolveTarget([], W, io(local, inherit("postgres://u:p@dev.example/app"))), /DATABASE_URL\(local\/app\)と違います/);
});

test("継いだ ENV_FILE はそのまま読むファイル(段階は --env と一致が要る)。新しい止め方は無い", () => {
  const files = { ".env.development": DEV, ".env.production": PROD, ".env.production.other": PROD };
  const t = resolveTarget(["--env", "production", "--confirm=production"], W, io(files, { env: { ENV_FILE: ".env.production.other" } }));
  assert.deepEqual([t.stage, t.envFile, t.values.DATABASE_URL], ["production", ".env.production.other", "postgres://u:p@prod.example/app"]);
  const noFlag = resolveTarget(["--confirm=production"], W, io(files, { env: { ENV_FILE: ".env.production" } }));
  assert.deepEqual([noFlag.stage, noFlag.envFile], ["production", ".env.production"]);
  assert.throws(() => resolveTarget(["--env", "development"], W, io(files, { env: { ENV_FILE: ".env.production" } })), /と --env development が違います/);
});

test(".env.<段階>.local を上に重ねる(印が違えば止める)", () => {
  const t = resolveTarget([], W, io({ ".env.development": DEV, ".env.development.local": "DATABASE_URL=postgres://me@local/app\n" }));
  assert.equal(t.values.DATABASE_URL, "postgres://me@local/app");
  assert.throws(() => resolveTarget([], W, io({ ".env.development": DEV, ".env.development.local": "APP_ENV=production\n" })), /\.local の APP_ENV=production/);
});

test("ホストの env: ファイルが無く環境変数の APP_ENV が向き先と同じ時だけ進む(本番は --env と確認が要る)", () => {
  const host = { env: { APP_ENV: "production", DATABASE_URL: "postgres://u:p@prod.example/app" } };
  assert.throws(() => resolveTarget([], W, io({}, host)), /\.env\.development がありません/);
  assert.throws(() => resolveTarget(["--env", "production"], W, io({}, host)), /非対話では --confirm=production/);
  const t = resolveTarget(["--env", "production", "--confirm=production"], W, io({}, host));
  assert.deepEqual([t.stage, t.envFile, t.values], ["production", "(ホストの env)", {}]);
  // ホストの env の DATABASE_URL は継いだ値そのもの(比べる相手のファイルが無い)= 継いだ DATABASE_URL の検査は掛けない
});

test("デプロイの確認(confirmProduction): 非対話は拒否、--confirm=production で通る、違う値は止める", () => {
  assert.throws(() => confirmProduction({ confirm: null }, io({}), "pnpm live:all"), /pnpm live:all: 本番.*--confirm=production/);
  assert.doesNotThrow(() => confirmProduction({ confirm: "production" }, io({}), "pnpm live:all"));
  assert.throws(() => confirmProduction({ confirm: "staging" }, io({}), "pnpm live:all"), /向き先\(production\)と違います/);
});

// 入口の一覧: 書く入口と読む入口は全部、守りを呼ぶ(env ファイルを自前で読まない)
const WRITE_ENTRIES = [
  "scripts/runner/task/prepare.ts",
  "scripts/operations/db/push.ts",
  "scripts/operations/db/clear.ts",
  "scripts/operations/storage/setup.ts",
  "scripts/operations/storage/setup-cors.ts",
  "scripts/operations/mail/test-send.ts",
  "scripts/operations/data/import.ts",
  "scripts/operations/data/update.ts",
  "scripts/operations/data/delete.ts",
];
const READ_ENTRIES = ["scripts/operations/data/export.ts", "scripts/operations/db/check-schema-roundtrip.ts", "scripts/operations/db/inspect.ts", "scripts/operations/firestore/inspect.ts", "scripts/operations/room/check.ts", "scripts/operations/claude/test.ts"];
const PREPARE_USERS = ["scripts/runner/task/run.ts", "scripts/runner/seed/run.ts", "scripts/workflow/dev-admin/run.ts"];
const DEPLOY_ENTRIES = ["scripts/operations/deploy/app.ts", "scripts/operations/deploy/all.ts", "scripts/operations/deploy/room.ts", "scripts/operations/room/deploy.ts", "scripts/operations/room/secret.ts"];

test("入口の一覧: 書く・読む入口は guardEntry、prepare の利用者は loadEnvFile、デプロイは guardDeploy を呼び、dotenv を自前で読まない", () => {
  const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
  for (const rel of WRITE_ENTRIES) assert.match(read(rel), /guardEntry\(\{ write: true/, rel);
  for (const rel of READ_ENTRIES) assert.match(read(rel), /guardEntry\(\{ write: /, rel);
  for (const rel of PREPARE_USERS) assert.match(read(rel), /loadEnvFile\("/, rel);
  for (const rel of DEPLOY_ENTRIES) assert.match(read(rel), /guardDeploy\(/, rel);
  for (const rel of DEPLOY_ENTRIES.filter((r) => !r.endsWith("/secret.ts"))) assert.match(read(rel), /guardSafePoint\(/, rel);
  for (const rel of [...WRITE_ENTRIES, ...READ_ENTRIES, ...PREPARE_USERS, ...DEPLOY_ENTRIES]) assert.doesNotMatch(read(rel), /from ["']dotenv["']/, rel);
});

test("デプロイ(指令 45 の事故の形): 非対話の pnpm live:all は --confirm が無ければ何も打たずに拒否、付ければ vercel --prod に進む(偽の vercel。進む側はルームが無効のときだけ)", (t) => {
  const bin = mkdtempSync(path.join(tmpdir(), "fake-vercel-"));
  dirs.push(bin);
  const log = path.join(bin, "calls.log");
  writeFileSync(path.join(bin, "vercel"), `#!/bin/sh\necho "$@" >> "${log}"\nexit 0\n`);
  chmodSync(path.join(bin, "vercel"), 0o755);
  const run = (args: string[]) =>
    spawnSync("npx", ["tsx", "scripts/operations/deploy/all.ts", ...args], {
      cwd: ROOT,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  const refused = run([]);
  assert.equal(refused.status, 1, refused.stdout + refused.stderr);
  assert.match(refused.stderr, /非対話では --confirm=production/);
  assert.doesNotMatch(refused.stdout, /pnpm check cron|vercel --prod/);
  assert.equal(existsSync(log), false, "vercel は一度も呼ばれない");
  if (roomWillDeploy()) {
    // ルームを有効にした fork では Worker のデプロイ(wrangler、偽物なし)が vercel より先に走り、本物の Cloudflare に触れる
    t.skip("--confirm=production で進む側（ルームの Worker のデプロイが先に走る設定では確かめない。拒否する側は確かめた）");
    return;
  }
  const allowed = run(["--confirm=production", "--allow-unsafe=テスト"]);
  assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr);
  assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), ["--version", "--prod"], "--confirm は vercel に渡さない");
});
