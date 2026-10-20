// 定期タスクの配線テスト。
// 実行: pnpm test:cron-wiring (node:test + tsx。task.ts を読むため tsx ランナーを使う)
//
// 登録は不要。src/app/api/cron/<name>/ を走査して検査する。守りたい契約(設計: src/lib/cron/README.md):
// 1. cron のフォルダには route.ts と task.ts がある。task.ts は cronTask を export し、name = フォルダ名
// 2. route.ts は ./task の cronTask を createCronTaskRoute で読む(定義を route.ts に二重に書かない)
// 3. タスク名はケバブケース、cadence は既知の区分、description あり、enabled は throw せず boolean を返す
// 4. vercel.json(あれば)は task.ts からの生成結果と一致する(配線漏れ・消えたタスクの残骸・手書きの時刻を検出)
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CRON_ROUTE_DIR, listCronTaskDirs, loadCronTasks } from "./discover.ts";
import { CRON_SCHEDULE_CONFIG } from "../../src/config/app/cron-schedule.config.ts";
import { buildVercelCrons, checkVercelCrons, isAtMostDailySchedule } from "../../src/lib/cron/vercelCrons.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CADENCES = new Set(["15m", "hourly", "daily"]);

test("cron のフォルダには route.ts と task.ts があり、route.ts は ./task を読む", () => {
  for (const dir of listCronTaskDirs(repoRoot)) {
    const base = join(repoRoot, CRON_ROUTE_DIR, dir);
    assert.ok(existsSync(join(base, "task.ts")), `${dir}: task.ts が無い`);
    const routeFile = join(base, "route.ts");
    assert.ok(existsSync(routeFile), `${dir}: route.ts が無い`);
    const route = readFileSync(routeFile, "utf8");
    assert.ok(
      route.includes('from "./task"') && route.includes("createCronTaskRoute(cronTask)"),
      `${dir}: route.ts は export const GET = createCronTaskRoute(cronTask)(cronTask は ./task から)にする`,
    );
  }
});

test("task.ts の定義: name = フォルダ名・ケバブケース・既知の cadence・description・enabled は boolean", async () => {
  const tasks = await loadCronTasks(repoRoot); // name ≠ フォルダ名 / cronTask 未 export はここで throw
  for (const task of tasks) {
    assert.match(task.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${task.name}: ケバブケースにする`);
    assert.ok(CADENCES.has(task.cadence), `${task.name}: cadence ${task.cadence} は 15m|hourly|daily のいずれか`);
    assert.ok(task.description?.trim(), `${task.name}: description を書く`);
    if (task.enabled) assert.equal(typeof task.enabled(), "boolean", `${task.name}: enabled は boolean を返す`);
  }
});

test("vercel.json(あれば)は task.ts からの生成結果と一致する", async (t) => {
  const file = join(repoRoot, "vercel.json");
  if (!existsSync(file)) {
    t.skip("vercel.json なし(Vercel にデプロイするリポジトリは pnpm cron:generate --plan hobby|pro で生成する)");
    return;
  }
  const tasks = await loadCronTasks(repoRoot);
  const { errors } = checkVercelCrons(JSON.parse(readFileSync(file, "utf8")).crons ?? [], tasks, CRON_SCHEDULE_CONFIG);
  assert.deepEqual(errors, []);
});

test("cron-schedule.config の daily は 1 日 1 回(hobby で全タスクに使うため)", () => {
  assert.ok(isAtMostDailySchedule(CRON_SCHEDULE_CONFIG.daily), CRON_SCHEDULE_CONFIG.daily);
});

// ---- 純関数の単体テスト ----

const schedules = { "15m": "*/15 * * * *", hourly: "10 * * * *", daily: "0 18 * * *" };
const tasks = [
  { name: "b-daily", cadence: "daily" },
  { name: "a-daily", cadence: "daily" },
  { name: "c-hourly", cadence: "hourly" },
  { name: "d-15m", cadence: "15m" },
];

test("buildVercelCrons: pro は cadence どおり、毎時・毎日は名前順に 5 分ずつずらす", () => {
  assert.deepEqual(buildVercelCrons(tasks, "pro", schedules), [
    { path: "/api/cron/a-daily", schedule: "0 18 * * *" },
    { path: "/api/cron/b-daily", schedule: "5 18 * * *" },
    { path: "/api/cron/c-hourly", schedule: "10 * * * *" },
    { path: "/api/cron/d-15m", schedule: "*/15 * * * *" },
  ]);
});

test("buildVercelCrons: hobby は全タスクを 1 日 1 回にし、日付をまたいでも時刻が正しい", () => {
  const hobby = buildVercelCrons(tasks, "hobby", { ...schedules, daily: "55 23 * * *" });
  assert.deepEqual(
    hobby.map((entry) => entry.schedule),
    ["55 23 * * *", "0 0 * * *", "5 0 * * *", "10 0 * * *"],
  );
  assert.ok(hobby.every((entry) => isAtMostDailySchedule(entry.schedule)));
});

test("checkVercelCrons: 生成結果と一致すれば OK、漏れ・残骸・時刻違い・重複は失敗", () => {
  for (const plan of ["hobby", "pro"]) {
    assert.deepEqual(checkVercelCrons(buildVercelCrons(tasks, plan, schedules), tasks, schedules), { plan, errors: [] });
  }
  const pro = buildVercelCrons(tasks, "pro", schedules);

  const missing = checkVercelCrons(pro.slice(1), tasks, schedules);
  assert.equal(missing.plan, null);
  assert.ok(missing.errors.some((e) => e.startsWith("/api/cron/a-daily: エントリがありません")));

  const stale = checkVercelCrons([...pro, { path: "/api/cron/removed", schedule: "0 1 * * *" }], tasks, schedules);
  assert.ok(stale.errors.some((e) => e.startsWith("/api/cron/removed:")));

  const edited = checkVercelCrons(
    pro.map((entry) => (entry.path === "/api/cron/a-daily" ? { ...entry, schedule: "0 3 * * *" } : entry)),
    tasks,
    schedules,
  );
  assert.ok(edited.errors.some((e) => e.includes('schedule が "0 3 * * *"')));

  const duplicated = checkVercelCrons([...pro, pro[0]], tasks, schedules);
  assert.ok(duplicated.errors.some((e) => e.includes("重複")));

  assert.equal(checkVercelCrons(undefined, tasks, schedules).errors.length, 1);
  // /api/cron/ の外のエントリは対象外
  assert.deepEqual(checkVercelCrons([...pro, { path: "/api/other", schedule: "0 1 * * *" }], tasks, schedules).errors, []);
});
