// scripts/runner/guard/guard.test.ts — pnpm test scripts/runner/guard
// 書く入口の共通の守り: 向き先の選び方・段階の印・同じ DB・継いだ DATABASE_URL・本番の確認・ホストの env・旗の外し方、入口の一覧(全部が守りを呼ぶ)、
// 非対話の本番の門(方針と人の 1 回分の許可、D420)、デプロイ(指令 45 の事故の形: 非対話の pnpm live:all)が許可なしでは
// --confirm=production を付けても何も打たずに拒否されること(偽の vercel で確かめる。本物は呼ばない)。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { type AgentGate, confirmProduction, type GuardIO, parseGuardFlags, resolveTarget, stageOfFileName } from "./index";
import { readPermit, writePermit } from "../../workflow/devcheck/lib.allow.mjs";
import { roomWillDeploy } from "../../operations/deploy/lib";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const dirs: string[] = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const DEV = "APP_ENV=development\nDATABASE_URL=postgres://u:p@dev.example/app\n";
const PROD = "APP_ENV=production\nDATABASE_URL=postgres://u:p@prod.example/app\n";

/** 非対話の本番の門の差し替え: 方針と許可の有無、使った回数と出した行を数える */
function gate(policy: "off" | "manual", permitted: boolean) {
  const seen = { consumed: 0, kinds: [] as string[] };
  const agentGate = (kind: string): AgentGate => (seen.kinds.push(kind), { policy, permitted, consume: () => void (seen.consumed += 1) });
  return { agentGate, seen };
}

// 既定の門 = manual・許可あり(本番の他の止めを確かめるテストのため。門そのものは「非対話の本番の門」で確かめる)
function io(files: Record<string, string>, over: Partial<GuardIO> = {}): GuardIO & { prompts: string[]; said: string[] } {
  const prompts: string[] = [];
  const said: string[] = [];
  return {
    cwd: "/repo",
    env: {},
    isTTY: false,
    readFile: (file) => files[path.basename(file)] ?? null,
    prompt: (q) => (prompts.push(q), ""),
    agentGate: gate("manual", true).agentGate,
    say: (line) => void said.push(line),
    prompts,
    said,
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

test("本番: 開発と同じ DB は注意の 1 行で通る(D433)、本番の DB が空は DB に書く時だけ未設定で止める(同じ DB の判定には掛けない)", () => {
  const same = { ".env.development": DEV, ".env.production": "APP_ENV=production\nDATABASE_URL=postgres://other:pw@dev.example/app\n" };
  const sameIo = io(same);
  assert.doesNotThrow(() => resolveTarget(["--env", "production", "--confirm=production"], W, sameIo));
  assert.ok(sameIo.said.some((l) => /注意: 本番と開発が同じ DB\(dev\.example\/app\)/.test(l)));
  const empty = { ".env.development": DEV, ".env.production": "APP_ENV=production\nDATABASE_URL=\n" };
  assert.throws(() => resolveTarget(["--env", "production", "--confirm=production"], W, io(empty)), /本番の DATABASE_URL が空/);
  assert.doesNotThrow(() => resolveTarget(["--env", "production", "--confirm=production"], { write: true, what: "メール" }, io(empty)));
});

test("本番に書く: 非対話は門(方針と許可)で決まる、TTY は production と打てば通る、読むだけは確認なし", () => {
  const files = { ".env.development": DEV, ".env.production": PROD };
  const none = gate("manual", false);
  assert.throws(() => resolveTarget(["--env", "production", "--confirm=production"], W, io(files, { agentGate: none.agentGate })), /1 回分の許可\(\/allow dep\)/);
  const ok = gate("manual", true);
  assert.equal(resolveTarget(["--env", "production"], W, io(files, { agentGate: ok.agentGate })).stage, "production");
  assert.deepEqual([ok.seen.kinds, ok.seen.consumed], [["deploy"], 1]);
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
  assert.throws(() => resolveTarget(["--env", "production"], W, io({}, { ...host, agentGate: gate("manual", false).agentGate })), /1 回分の許可/);
  const t = resolveTarget(["--env", "production"], W, io({}, host));
  assert.deepEqual([t.stage, t.envFile, t.values], ["production", "(ホストの env)", {}]);
  // ホストの env の DATABASE_URL は継いだ値そのもの(比べる相手のファイルが無い)= 継いだ DATABASE_URL の検査は掛けない
});

test("非対話の本番の門(confirmProduction、D420): --confirm=production だけでは通さない、off は拒否、manual は許可で 1 回通して使う", () => {
  const off = gate("off", true);
  assert.throws(() => confirmProduction({ confirm: "production" }, io({}, { agentGate: off.agentGate }), "pnpm live:all"), /agent\.deploy が off/);
  const none = gate("manual", false);
  assert.throws(() => confirmProduction({ confirm: "production" }, io({}, { agentGate: none.agentGate }), "pnpm live:all"), /--confirm=production だけでは通しません/);
  assert.equal(none.seen.consumed, 0);
  const ok = gate("manual", true);
  const io1 = io({}, { agentGate: ok.agentGate });
  assert.doesNotThrow(() => confirmProduction({ confirm: null }, io1, "pnpm live:all"));
  assert.deepEqual([ok.seen.consumed, io1.said.length], [1, 1]);
  const evp = gate("manual", false);
  assert.throws(() => confirmProduction({ confirm: null }, io({}, { agentGate: evp.agentGate }), "pnpm ops vercel env-add", "env_production"), /\/allow evp/);
  assert.deepEqual(evp.seen.kinds, ["env_production"]);
  const broken = (): AgentGate => {
    throw new Error("repo.json: 形の誤り");
  };
  assert.throws(() => confirmProduction({ confirm: null }, io({}, { agentGate: broken }), "pnpm live:all"), /方針\(repo\.json の agent\.deploy\)が読めません/);
  // 端末の人は門を見ない(今のまま): --confirm=production なら問わない、無ければ production と打つ
  const tty = gate("off", false);
  assert.doesNotThrow(() => confirmProduction({ confirm: "production" }, io({}, { isTTY: true, agentGate: tty.agentGate }), "pnpm live:all"));
  assert.doesNotThrow(() => confirmProduction({ confirm: null }, io({}, { isTTY: true, prompt: () => "production", agentGate: tty.agentGate }), "pnpm live:all"));
  assert.deepEqual(tty.seen.kinds, []);
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
// ホスティング側の設定を書く入口(本番の確認だけ、何も出さないのでセーフポイントは見ない)
const VERCEL_WRITES = ["scripts/operations/vercel/env-add.ts", "scripts/operations/vercel/env-rm.ts", "scripts/operations/vercel/env-pull.ts"];
const DEPLOY_ENTRIES = ["scripts/operations/deploy/app.ts", "scripts/operations/deploy/all.ts", "scripts/operations/deploy/room.ts", "scripts/operations/room/deploy.ts", "scripts/operations/room/secret.ts", ...VERCEL_WRITES];

test("入口の一覧: 書く・読む入口は guardEntry、prepare の利用者は loadEnvFile、デプロイは guardDeploy を呼び、dotenv を自前で読まない", () => {
  const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
  for (const rel of WRITE_ENTRIES) assert.match(read(rel), /guardEntry\(\{ write: true/, rel);
  for (const rel of READ_ENTRIES) assert.match(read(rel), /guardEntry\(\{ write: /, rel);
  for (const rel of PREPARE_USERS) assert.match(read(rel), /loadEnvFile\("/, rel);
  for (const rel of DEPLOY_ENTRIES) assert.match(read(rel), /guardDeploy\(/, rel);
  for (const rel of DEPLOY_ENTRIES.filter((r) => !r.endsWith("/secret.ts") && !VERCEL_WRITES.includes(r))) assert.match(read(rel), /guardSafePoint\(/, rel);
  for (const rel of [...WRITE_ENTRIES, ...READ_ENTRIES, ...PREPARE_USERS, ...DEPLOY_ENTRIES]) assert.doesNotMatch(read(rel), /from ["']dotenv["']/, rel);
});

test("デプロイ(指令 45 の事故の形): 非対話の pnpm live:all は許可が無ければ --confirm=production を付けても何も打たずに拒否、dep の許可があれば vercel --prod に進み許可を使う(偽の vercel。進む側はルームが無効で、このチェックアウトに人の許可が無い時だけ)", (t) => {
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
  if (readPermit(ROOT)) {
    t.skip("このチェックアウトに人の 1 回分の許可がある(使ってしまうので確かめない)");
    return;
  }
  const refused = run(["--confirm=production"]);
  assert.equal(refused.status, 1, refused.stdout + refused.stderr);
  assert.match(refused.stderr, /非対話の本番は/);
  assert.doesNotMatch(refused.stdout, /pnpm check cron|vercel --prod/);
  assert.equal(existsSync(log), false, "vercel は一度も呼ばれない");
  if (roomWillDeploy()) {
    // ルームを有効にした fork では Worker のデプロイ(wrangler、偽物なし)が vercel より先に走り、本物の Cloudflare に触れる
    t.skip("許可で進む側（ルームの Worker のデプロイが先に走る設定では確かめない。拒否する側は確かめた）");
    return;
  }
  if (/agent\.deploy が off/.test(refused.stderr)) {
    t.skip("このチェックアウトの方針 agent.deploy が off(進む側は無い。拒否する側は確かめた)");
    return;
  }
  writePermit(ROOT, ["dep"], "guard.test の進む側");
  const allowed = run(["--allow-unsafe=テスト"]);
  assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr);
  assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), ["--version", "--prod"], "--confirm は vercel に渡さない");
  assert.equal(readPermit(ROOT), null, "許可は使って消える");
});
