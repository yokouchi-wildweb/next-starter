// 定期タスクの配線テスト。
// 実行: pnpm test:cron-wiring (node:test + tsx。task.ts を読むため tsx ランナーを使う)
//
// 登録は不要。src/app/api/cron/<name>/ を走査して検査する。守りたい契約(設計: src/lib/cron/README.md):
// 1. cron のフォルダには route.ts と task.ts がある。task.ts は cronTask を export し、name = フォルダ名
// 2. route.ts は ./task の cronTask を createCronTaskRoute で読む(定義を route.ts に二重に書かない)
// 3. タスク名はケバブケース、schedule は正しい cron 式、description あり、enabled は throw せず boolean を返す
// 4. vercel.json(あれば)は task.ts からの生成結果と一致する(配線漏れ・消えたタスクの残骸・手書きの時刻を検出)
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CRON_ROUTE_DIR, listCronTaskDirs, loadCronTasks } from "./discover.ts";
import { buildVercelCrons, checkVercelCrons, listHobbyDowngradedTasks } from "../../src/lib/cron/vercelCrons.ts";
import {
  isAtMostDailySchedule,
  isValidCronExpression,
  matchesCronExpression,
} from "../../src/lib/cron/cronExpression.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

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

test("task.ts の定義: name = フォルダ名・ケバブケース・正しい cron 式・description・enabled は boolean", async () => {
  const tasks = await loadCronTasks(repoRoot); // name ≠ フォルダ名 / cronTask 未 export はここで throw
  for (const task of tasks) {
    assert.match(task.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${task.name}: ケバブケースにする`);
    assert.ok(isValidCronExpression(task.schedule), `${task.name}: schedule "${task.schedule}" は 5 フィールドの cron 式(UTC)にする`);
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
  const { errors } = checkVercelCrons(JSON.parse(readFileSync(file, "utf8")).crons ?? [], tasks);
  assert.deepEqual(errors, []);
});

// ---- 純関数の単体テスト ----

test("cron 式の検証: 範囲・間隔・リストを受け、フィールド数違い・範囲外・名前表記は拒否", () => {
  for (const ok of ["* * * * *", "*/15 * * * *", "55 14 * * *", "0 9-18/3 * * 1-5", "0,30 * 1,15 * *", "0 0 * * 7"]) {
    assert.ok(isValidCronExpression(ok), ok);
  }
  for (const ng of ["* * * *", "60 * * * *", "0 24 * * *", "0 0 0 * *", "0 0 * * MON", "*/0 * * * *", "5-1 * * * *"]) {
    assert.ok(!isValidCronExpression(ng), ng);
  }
  assert.ok(isAtMostDailySchedule("55 14 * * *"));
  assert.ok(isAtMostDailySchedule("0 3 * * 1"));
  assert.ok(!isAtMostDailySchedule("*/15 * * * *"));
  assert.ok(!isAtMostDailySchedule("0 */6 * * *"));
});

test("cron 式の照合: UTC の分で判定し、日と曜日が両方指定なら OR", () => {
  const at = (iso) => new Date(iso);
  assert.ok(matchesCronExpression("* * * * *", at("2026-10-20T14:55:00Z")));
  assert.ok(matchesCronExpression("55 14 * * *", at("2026-10-20T14:55:30Z")));
  assert.ok(!matchesCronExpression("55 14 * * *", at("2026-10-20T14:56:00Z")));
  assert.ok(matchesCronExpression("*/15 * * * *", at("2026-10-20T03:45:00Z")));
  assert.ok(!matchesCronExpression("*/15 * * * *", at("2026-10-20T03:46:00Z")));
  // 2026-10-20 は火曜(2)。日=1 または 火曜 → 一致
  assert.ok(matchesCronExpression("0 0 1 * 2", at("2026-10-20T00:00:00Z")));
  // 日曜は 0 でも 7 でも一致(2026-10-18 は日曜)
  assert.ok(matchesCronExpression("0 0 * * 7", at("2026-10-18T00:00:00Z")));
});

const tasks = [
  { name: "b-daily", schedule: "5 18 * * *" },
  { name: "a-daily", schedule: "0 18 * * *" },
  { name: "c-minutely", schedule: "* * * * *" },
  { name: "d-hourly", schedule: "10 * * * *" },
];

test("buildVercelCrons: pro は task.ts の schedule をそのまま使う(名前順)", () => {
  assert.deepEqual(buildVercelCrons(tasks, "pro"), [
    { path: "/api/cron/a-daily", schedule: "0 18 * * *" },
    { path: "/api/cron/b-daily", schedule: "5 18 * * *" },
    { path: "/api/cron/c-minutely", schedule: "* * * * *" },
    { path: "/api/cron/d-hourly", schedule: "10 * * * *" },
  ]);
});

test("buildVercelCrons: hobby は 1 日 1 回より細かいものだけ 19:00 UTC から 5 分ずつずらして 1 日 1 回にする", () => {
  assert.deepEqual(buildVercelCrons(tasks, "hobby"), [
    { path: "/api/cron/a-daily", schedule: "0 18 * * *" },
    { path: "/api/cron/b-daily", schedule: "5 18 * * *" },
    { path: "/api/cron/c-minutely", schedule: "0 19 * * *" },
    { path: "/api/cron/d-hourly", schedule: "5 19 * * *" },
  ]);
  assert.deepEqual(listHobbyDowngradedTasks(tasks), ["c-minutely", "d-hourly"]);
});

test("checkVercelCrons: 生成結果と一致すれば OK、漏れ・残骸・時刻違い・重複・不正な schedule は失敗", () => {
  for (const plan of ["hobby", "pro"]) {
    assert.deepEqual(checkVercelCrons(buildVercelCrons(tasks, plan), tasks), { plan, errors: [] });
  }
  const pro = buildVercelCrons(tasks, "pro");

  const missing = checkVercelCrons(pro.slice(1), tasks);
  assert.equal(missing.plan, null);
  assert.ok(missing.errors.some((e) => e.startsWith("/api/cron/a-daily: エントリがありません")));

  const stale = checkVercelCrons([...pro, { path: "/api/cron/removed", schedule: "0 1 * * *" }], tasks);
  assert.ok(stale.errors.some((e) => e.startsWith("/api/cron/removed:")));

  const edited = checkVercelCrons(
    pro.map((entry) => (entry.path === "/api/cron/a-daily" ? { ...entry, schedule: "0 3 * * *" } : entry)),
    tasks,
  );
  assert.ok(edited.errors.some((e) => e.includes('schedule が "0 3 * * *"')));

  assert.ok(checkVercelCrons([...pro, pro[0]], tasks).errors.some((e) => e.includes("重複")));
  assert.equal(checkVercelCrons(undefined, tasks).errors.length, 1);
  assert.ok(checkVercelCrons(pro, [...tasks, { name: "bad", schedule: "every day" }]).errors[0].startsWith("bad:"));
  // /api/cron/ の外のエントリは対象外
  assert.deepEqual(checkVercelCrons([...pro, { path: "/api/other", schedule: "0 1 * * *" }], tasks).errors, []);
});
