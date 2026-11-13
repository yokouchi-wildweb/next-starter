// scripts/workflow/devcheck/devcheck.run.test.ts — pnpm test scripts/workflow/devcheck
//
// 実行の層(run / cleanup)を偽の Deps で: 方針(off は手で・manual は --manual-go)・DB の 1 文の検査と打つコマンド(--env 無し)・
// 作った行の記録と片付け・サーバーの上限の待ち・この命令が立てたサーバーだけ止める・env-add は値を出さない・管理者の答えの読み方

import assert from "node:assert/strict";
import { test } from "node:test";

import { POLICY_KEYS, STANDALONE, parseAdminCheck, type Context, type Item, type Policy } from "./lib";
import { execCleanup, execRun, type Deps } from "./lib.exec";
import { appendEnv, checkStatement, deleteSql, devTabStarted, waitForSlot, type DevcheckRecord, type RunResult } from "./lib.run";

const ALL_AUTO = { ...Object.fromEntries(POLICY_KEYS.map((k) => [k, "auto"])), db_push: "off", env_production: "off", deploy: "off" } as Policy;

type Fake = Deps & { typed: string[][]; lines: string[]; record: DevcheckRecord | null; env: string; slept: number };

const fake = (over: Partial<Deps> = {}, answers: (argv: string[]) => RunResult = () => ({ code: 0, stdout: "", stderr: "" })): Fake => {
  const f = {
    typed: [] as string[][],
    lines: [] as string[],
    record: null as DevcheckRecord | null,
    env: "APP_ENV=development\n",
    slept: 0,
  } as Fake;
  Object.assign(f, {
    root: "/repo",
    context: STANDALONE,
    policy: ALL_AUTO,
    items: [] as Item[],
    runner: (argv: string[]) => {
      f.typed.push(argv);
      return answers(argv);
    },
    readRecord: () => f.record,
    writeRecord: (r: DevcheckRecord) => {
      f.record = r;
    },
    removeRecord: () => {
      f.record = null;
    },
    readEnvFile: () => f.env,
    writeEnvFile: (t: string) => {
      f.env = t;
    },
    readStdin: () => "s3cret-value\n",
    countLiveServers: () => 0,
    sleep: async (ms: number) => {
      f.slept += ms;
    },
    waitSec: 10,
    out: (l: string) => f.lines.push(l),
    ...over,
  });
  return f;
};

test("方針: off は打たずに断る(exit 4・手で)、manual は --manual-go の時だけ、browser / cleanup は run の対象ではない", async () => {
  const off = fake({ policy: { ...ALL_AUTO, test: "off" } });
  assert.equal((await execRun(["test", "src/x"], off)).code, 4);
  assert.deepEqual(off.typed, []);
  assert.match(off.lines[0], /方針で off: 人が打つなら .+、任せるなら \/repo-policy で agent\.\S+ を manual に/);
  const manual = fake({ policy: { ...ALL_AUTO, check: "manual" } });
  assert.equal((await execRun(["check", "rules"], manual)).code, 4);
  assert.equal((await execRun(["check", "rules", "--manual-go"], manual)).code, 0);
  assert.deepEqual(manual.typed, [["pnpm", "check", "rules"]]);
  await assert.rejects(execRun(["browser"], fake()), /エージェントが Playwright/);
  await assert.rejects(execRun(["cleanup"], fake()), /devcheck cleanup/);
  await assert.rejects(execRun(["deploy"], fake()), /知らない候補/);
});

test("DB の 1 文: INSERT … RETURNING / DELETE … WHERE だけ。DDL・UPDATE・複数の文・WHERE 無し・RETURNING 無しは断る", () => {
  assert.deepEqual(checkStatement("db-write", 'INSERT INTO "tags" (name) VALUES (\'x\') RETURNING id;'), { kind: "db-write", table: "tags", column: "id" });
  assert.deepEqual(checkStatement("db-delete", "DELETE FROM tags WHERE name = 'x'"), { kind: "db-delete", table: "tags" });
  for (const bad of ["INSERT INTO tags (name) VALUES ('x')", "UPDATE tags SET name = 'y' RETURNING id", "DROP TABLE tags", "INSERT INTO tags VALUES (1) RETURNING id; DROP TABLE tags", "INSERT INTO public.tags VALUES (1) RETURNING id"]) {
    assert.throws(() => checkStatement("db-write", bad), /db-write/, bad);
  }
  for (const bad of ["DELETE FROM tags", "TRUNCATE tags", "DELETE FROM tags WHERE 1=1; DELETE FROM users WHERE 1=1"]) {
    assert.throws(() => checkStatement("db-delete", bad), /db-delete/, bad);
  }
  assert.equal(deleteSql("tags", "id", ["a", "o'k"]), `DELETE FROM "tags" WHERE "id" IN ('a', 'o''k')`);
});

test("db-write: guard を通る入口を --env 無しで打ち、返った id を記録 → cleanup がその行だけ消して記録を消す", async () => {
  const f = fake({}, (argv) => (argv.includes("query") ? { code: 0, stdout: '[{"id":"t1"},{"id":"t2"}]\n', stderr: "" } : { code: 0, stdout: "", stderr: "" }));
  assert.equal((await execRun(["db-write", "INSERT INTO tags (name) VALUES ('a'), ('b') RETURNING id"], f)).code, 0);
  assert.deepEqual(f.typed[0], ["pnpm", "-s", "ops", "db", "inspect", "query", "INSERT INTO tags (name) VALUES ('a'), ('b') RETURNING id", "--json"]);
  for (const argv of f.typed) assert.equal(argv.some((a) => /^--env|^--confirm|db:push/.test(a)), false);
  assert.deepEqual(f.record?.rows, [{ table: "tags", column: "id", ids: ["t1", "t2"] }]);
  f.typed = [];
  assert.equal(execCleanup(f).code, 0);
  assert.deepEqual(f.typed, [["pnpm", "-s", "ops", "db", "inspect", "query", `DELETE FROM "tags" WHERE "id" IN ('t1', 't2')`, "--json"]]);
  assert.equal(f.record, null);
  assert.match(f.lines.at(-1) ?? "", /画面から作った行は/);
});

test("server: 文脈が裏なら --background。立てた時だけ記録し、cleanup はそれだけ止める(もう動いていた・外のサーバーは止めない)", async () => {
  const bg: Context = { ...STANDALONE, file: "/ctx", server: "background" };
  const started = fake({ context: bg }, () => ({ code: 0, stdout: "開発サーバーを立てました: http://localhost:3000 — …\n", stderr: "" }));
  await execRun(["server"], started);
  assert.deepEqual(started.typed[0], ["pnpm", "-s", "workflow", "dev-tab", "run", "--background"]);
  assert.equal(started.record?.startedServer, true);
  started.typed = [];
  execCleanup(started);
  assert.deepEqual(started.typed, [["pnpm", "-s", "workflow", "dev-tab", "run", "stop"]]);
  const already = fake({}, () => ({ code: 0, stdout: "開発サーバーはもう動いています: …\n", stderr: "" }));
  await execRun(["server"], already);
  assert.equal(already.record, null);
  assert.equal(devTabStarted({ code: 3, stdout: "", stderr: "外で動いています" }), false);
  assert.equal(devTabStarted({ code: 0, stdout: "開発サーバーを起動中です(60 秒で応答なし…)", stderr: "" }), true);
  const nothing = fake();
  assert.equal(execCleanup(nothing).code, 0);
  assert.deepEqual(nothing.typed, []);
  assert.match(nothing.lines[0], /片付けるものなし/);
});

test("server の上限: dev_max 以上なら 5 秒ごとに数え直し、空けば立てる・待ちきれなければ exit 5 で立てない(3 は dev-tab の外のサーバー)", async () => {
  const ctx: Context = { ...STANDALONE, file: "/ctx", devMax: 2 };
  let n = 3;
  const freed = fake({ context: ctx, countLiveServers: () => n-- }, () => ({ code: 0, stdout: "開発サーバーを立てました: …", stderr: "" }));
  assert.equal((await execRun(["server"], freed)).code, 0);
  assert.equal(freed.slept, 10000);
  const full = fake({ context: ctx, countLiveServers: () => 2, waitSec: 10 });
  assert.equal((await execRun(["server"], full)).code, 5);
  const outside = fake({}, () => ({ code: 3, stdout: "", stderr: "この道具の外で開発サーバーが動いています" }));
  assert.equal((await execRun(["server"], outside)).code, 3);
  assert.equal(outside.record, null);
  assert.deepEqual(full.typed, []);
  assert.equal(await waitForSlot(null, () => 99, async () => {}, 0), true);
});

test("env-add: .env.development に足し、値は出さない。もうある鍵・形の違う鍵は断る", async () => {
  const f = fake();
  assert.equal((await execRun(["env-add", "STRIPE_KEY"], f)).code, 0);
  assert.equal(f.env, "APP_ENV=development\nSTRIPE_KEY=s3cret-value\n");
  assert.equal(f.lines.join("\n").includes("s3cret"), false);
  await assert.rejects(execRun(["env-add", "STRIPE_KEY"], f), /もう \.env\.development にある/);
  assert.throws(() => appendEnv("", "lower", "v"), /英大文字/);
  assert.throws(() => appendEnv("", "K", "a\nb"), /値は 1 行/);
  assert.equal(appendEnv("A=1", "B", "2"), "A=1\nB=2\n");
});

test("test / check / login / fork の項目: シェルを通さず打ち、終了コードをそのまま返す", async () => {
  const items: Item[] = [{ name: "orders-smoke", kind: "check", command: "pnpm workflow orders smoke", what: "", file: "a.json" }];
  const f = fake({ items }, (argv) => ({ code: argv[1] === "test" ? 7 : 0, stdout: "out", stderr: "" }));
  assert.equal((await execRun(["test", "src/a", "src/b"], f)).code, 7);
  await execRun(["login"], f);
  await execRun(["orders-smoke"], f);
  assert.deepEqual(f.typed, [
    ["pnpm", "test", "src/a", "src/b"],
    ["pnpm", "-s", "workflow", "dev-admin", "run"],
    ["pnpm", "workflow", "orders", "smoke"],
  ]);
  await assert.rejects(execRun(["orders-smoke", "extra"], f), /引数を取らない/);
  const offItem = fake({ items, policy: { ...ALL_AUTO, check: "off" } });
  assert.equal((await execRun(["orders-smoke"], offItem)).code, 4);
});

test("管理者の答え(dev-admin run --check): いる / いない / 分からない(理由)", () => {
  assert.deepEqual(parseAdminCheck(0, '{"ok":true,"action":"check","present":true}\n', ""), { present: true });
  assert.deepEqual(parseAdminCheck(0, '{"ok":true,"action":"check","present":false}', ""), { present: false });
  assert.deepEqual(parseAdminCheck(1, "", '{"ok":false,"action":"check","error":"dev-admin: DB 未設定"}'), { unknown: "dev-admin: DB 未設定" });
  assert.deepEqual(parseAdminCheck(1, "", "ERR_PNPM_NO_SCRIPT"), { unknown: "ERR_PNPM_NO_SCRIPT" });
});
