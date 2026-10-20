// 定期タスクの配線テスト。
// 実行: pnpm test:cron-wiring (node:test + tsx。registry の .ts を読むため tsx ランナーを使う)
//
// 守りたい契約(設計: src/lib/cron/README.md):
// 1. レジストリ(src/registry/cronTaskRegistry.ts + fork の forkCronTaskRegistry.ts)のタスク名は一意・ケバブケース
// 2. src/app/api/cron/<name>/ のルートは全てレジストリに登録されている(未登録 = dispatcher が起動しない = 配線漏れ)
// 3. 登録済みタスクには個別ルートがあり、getCronTask("<name>") で自分の定義を読む(dispatcher はこのルートを呼ぶ)
// 4. vercel.json.example と(あれば)vercel.json は dispatcher だけを登録した形(個別エントリ併記 = 二重実行)
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CORE_CRON_TASKS, CRON_TASKS } from "../../registry/cronTaskRegistry.ts";
import { CRON_SCHEDULE_CONFIG } from "../../config/app/cron-schedule.config.ts";
import { buildVercelCrons, checkVercelCrons, isAtMostDailySchedule } from "./vercelCrons.ts";
import { selectCronDispatchTargets } from "./createCronDispatchRoute.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cronRouteRoot = join(repoRoot, "src/app/api/cron");
const DISPATCH_DIR = "dispatch";
const CADENCES = new Set(["15m", "hourly", "daily"]);

test("タスク名は一意・ケバブケースで、cadence は既知の区分", () => {
  const seen = new Set();
  for (const task of CRON_TASKS) {
    assert.match(task.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${task.name}: ケバブケースにする`);
    assert.notEqual(task.name, DISPATCH_DIR, `${task.name}: dispatcher と同じ名前は使えない`);
    assert.ok(!seen.has(task.name), `${task.name}: 重複登録(upstream と fork で同名にしない)`);
    seen.add(task.name);
    assert.ok(CADENCES.has(task.cadence), `${task.name}: cadence ${task.cadence} は 15m|hourly|daily のいずれか`);
    assert.ok(task.description?.trim(), `${task.name}: description を書く`);
  }
});

test("src/app/api/cron/ のルートは全てレジストリに登録されている", () => {
  const names = new Set(CRON_TASKS.map((task) => task.name));
  const dirs = readdirSync(cronRouteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== DISPATCH_DIR)
    .map((entry) => entry.name);
  const unregistered = dirs.filter((dir) => !names.has(dir));
  assert.deepEqual(
    unregistered,
    [],
    `未登録の cron ルート(dispatcher が起動しない): ${unregistered.join(", ")} → ` +
      "src/registry/forkCronTaskRegistry.ts(fork)か cronTaskRegistry.ts(upstream)に登録する",
  );
});

test("登録済みタスクには getCronTask で自分を読む個別ルートがある", () => {
  for (const task of CRON_TASKS) {
    const file = join(cronRouteRoot, task.name, "route.ts");
    assert.ok(existsSync(file), `${task.name}: ${file} が無い(dispatcher が呼ぶ先)`);
    const source = readFileSync(file, "utf8");
    assert.ok(
      source.includes(`getCronTask("${task.name}")`),
      `${task.name}: route.ts は createCronTaskRoute(getCronTask("${task.name}")) で登録内容を読む`,
    );
  }
});

test("dispatcher ルートがある", () => {
  assert.ok(existsSync(join(cronRouteRoot, DISPATCH_DIR, "[cadence]", "route.ts")));
});

test("upstream のタスクの enabled は throw しない(dispatcher の起動判定で落ちない)", () => {
  for (const task of CORE_CRON_TASKS) {
    if (task.enabled) assert.equal(typeof task.enabled(), "boolean", task.name);
  }
});

test("vercel.json.example は dispatcher だけを登録した pro の形", () => {
  const example = JSON.parse(readFileSync(join(repoRoot, "vercel.json.example"), "utf8"));
  const { plan, errors } = checkVercelCrons(example.crons);
  assert.deepEqual(errors, []);
  assert.equal(plan, "pro", "vercel.json.example は pnpm cron:generate --plan pro --file vercel.json.example で生成する");
});

test("vercel.json(あれば)は dispatcher だけを登録した形", (t) => {
  const file = join(repoRoot, "vercel.json");
  if (!existsSync(file)) {
    t.skip("vercel.json なし(Vercel にデプロイする fork は pnpm cron:generate --plan hobby|pro で生成する)");
    return;
  }
  const { errors } = checkVercelCrons(JSON.parse(readFileSync(file, "utf8")).crons);
  assert.deepEqual(errors, []);
});

test("cron-schedule.config の daily は 1 日 1 回(hobby の dispatcher に使うため)", () => {
  assert.ok(isAtMostDailySchedule(CRON_SCHEDULE_CONFIG.daily), CRON_SCHEDULE_CONFIG.daily);
});

// ---- 純関数の単体テスト ----

const schedules = { "15m": "*/15 * * * *", hourly: "10 * * * *", daily: "0 18 * * *" };

test("buildVercelCrons: hobby は日次 1 本、pro は区分ごとに 1 本", () => {
  assert.deepEqual(buildVercelCrons("hobby", schedules), [{ path: "/api/cron/dispatch/all", schedule: "0 18 * * *" }]);
  assert.deepEqual(
    buildVercelCrons("pro", schedules).map((entry) => entry.path),
    ["/api/cron/dispatch/15m", "/api/cron/dispatch/hourly", "/api/cron/dispatch/daily"],
  );
  for (const plan of ["hobby", "pro"]) {
    assert.deepEqual(checkVercelCrons(buildVercelCrons(plan, schedules)), { plan, errors: [] });
  }
});

test("checkVercelCrons: 個別エントリの併記・部分的な pro・hobby の高頻度・配列でない値を失敗にする", () => {
  const pro = buildVercelCrons("pro", schedules);
  const withLegacy = checkVercelCrons([...pro, { path: "/api/cron/audit-log-prune", schedule: "0 3 * * *" }]);
  assert.equal(withLegacy.errors.length, 1);
  assert.match(withLegacy.errors[0], /二重実行/);

  assert.equal(checkVercelCrons(pro.slice(0, 2)).plan, null);
  assert.equal(checkVercelCrons([]).plan, null);
  assert.equal(checkVercelCrons(undefined).errors.length, 1);

  const hobbyHourly = checkVercelCrons([{ path: "/api/cron/dispatch/all", schedule: "0 * * * *" }]);
  assert.equal(hobbyHourly.plan, "hobby");
  assert.match(hobbyHourly.errors[0], /Hobby/);

  // /api/cron/ の外のエントリは対象外
  assert.deepEqual(checkVercelCrons([...pro, { path: "/api/other", schedule: "0 1 * * *" }]).errors, []);
});

test("selectCronDispatchTargets: cadence で絞り、enabled が false のものは skipped に分ける", () => {
  const run = async () => ({});
  const tasks = [
    { name: "a", description: "a", cadence: "daily", run },
    { name: "b", description: "b", cadence: "hourly", run },
    { name: "c", description: "c", cadence: "daily", enabled: () => false, run },
  ];
  const daily = selectCronDispatchTargets(tasks, "daily");
  assert.deepEqual(daily.targets.map((task) => task.name), ["a"]);
  assert.deepEqual(daily.skipped, ["c"]);
  assert.deepEqual(selectCronDispatchTargets(tasks, "all").targets.map((task) => task.name), ["a", "b"]);
});
