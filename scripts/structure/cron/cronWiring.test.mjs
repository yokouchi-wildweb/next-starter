// 定期タスクの配線テスト。
// 実行: pnpm test scripts/structure/cron/cronWiring.test.mjs (node:test + tsx。task.ts を読むため tsx ランナーを使う)
//
// 登録は不要。src/app/api/cron/<name>/ を走査して検査する。守りたい契約(設計: src/lib/cron/README.md):
// 1. cron のフォルダには route.ts と task.ts がある。task.ts は cronTask を export し、name = フォルダ名
// 2. route.ts は ./task の cronTask を @/wiring/cronRoute の createCronTaskRoute で読む(定義を route.ts に二重に書かない。
//    門番の判定は wiring が結ぶ: 住所 /api/cron/<name> が閉じていれば route・pnpm task は飛ばし、vercel.json に載せない)
// 3. タスク名はケバブケース、schedule は正しい cron 式、description あり、enabled は throw せず boolean を返す。
//    task.ts は門番(@/featureGate)を読まない(機能の入切は住所で自動。Tier1 は失敗、fork は冗長なだけなので一覧を出す)
// 4. fork の task.override.ts(任意)は schedule の差し替えと disabled だけを持ち、task.ts の無いフォルダには置けない
// 5. README と task.ts / task.override.ts が @/lib/cron から import する名前は、すべて src/lib/cron/index.ts が export している
// 6. vercel.json(あれば)は task.ts(+ task.override.ts)からの生成結果と一致する(配線漏れ・消えたタスクの残骸・手書きの時刻を検出)
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CRON_ROUTE_DIR, gateClosedBy, listCronTaskDirs, loadCronTasks, scheduledCronTasks } from "./discover.ts";
import { createCronRoute, createCronTaskRoute } from "../../../src/lib/cron/createCronRoute.ts";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";
import { buildVercelCrons, checkVercelCrons, listHobbyDowngradedTasks } from "../../../src/lib/cron/vercelCrons.ts";
import {
  isAtMostDailySchedule,
  isValidCronExpression,
  matchesCronExpression,
} from "../../../src/lib/cron/cronExpression.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

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
    assert.ok(
      route.includes('from "@/wiring/cronRoute"'),
      `${dir}: route.ts の createCronTaskRoute は @/wiring/cronRoute から読む(門番の判定を結んだ版。lint cron-route-via-wiring)`,
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

/** task.ts の中の門番の import(@/featureGate とその下。コメントは除く) */
export function gateImportsIn(text) {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...code.matchAll(/(?:from\s+|import\(\s*)["'](@\/featureGate(?:\/[^"']*)?)["']/g)].map((m) => m[1]);
}

test("gateImportsIn: 門番の import を拾い、コメントと他の import は拾わない", () => {
  assert.deepEqual(gateImportsIn(`import { gate } from "@/featureGate";\nimport type { X } from "@/lib/cron";`), ["@/featureGate"]);
  assert.deepEqual(gateImportsIn(`// import { gate } from "@/featureGate";\nconst x = await import("@/featureGate/node");`), ["@/featureGate/node"]);
  assert.deepEqual(gateImportsIn(`import { a } from "@/features/core/wallet";`), []);
});

test("task.ts は機能の入切を書かない(門番を読まない。住所 /api/cron/<name> を規則の pathPatterns に書けば自動): Tier1 は失敗、fork は一覧だけ", (t) => {
  const identity = readForkIdentity(repoRoot);
  assert.deepEqual(identity.errors, [], identity.errors.join("\n"));
  const hits = listCronTaskDirs(repoRoot)
    .map((dir) => ({ dir, sources: gateImportsIn(readFileSync(join(repoRoot, CRON_ROUTE_DIR, dir, "task.ts"), "utf8")) }))
    .filter((hit) => hit.sources.length > 0)
    .map((hit) => `${CRON_ROUTE_DIR}/${hit.dir}/task.ts → ${hit.sources.join(", ")}`);
  const message = `task.ts が門番を読んでいる(機能の入切は書かない。enabled には機能以外の条件だけ。src/lib/cron/README.md「機能の門」):\n${hits.join("\n")}`;
  if (identity.isTier1) {
    assert.deepEqual(hits, [], message);
  } else if (hits.length > 0) {
    t.diagnostic(message);
  }
});

test("README と task.ts / task.override.ts が @/lib/cron から import する名前は index.ts が export している", () => {
  const indexSource = readFileSync(join(repoRoot, "src/lib/cron/index.ts"), "utf8");
  const exported = new Set();
  for (const [, names] of indexSource.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const name of names.split(",")) {
      const trimmed = name.trim().replace(/^type\s+/, "");
      if (trimmed) exported.add(trimmed.split(/\s+as\s+/).pop());
    }
  }
  const sources = [join(repoRoot, "src/lib/cron/README.md")];
  for (const dir of listCronTaskDirs(repoRoot)) {
    for (const file of ["task.ts", "task.override.ts", "route.ts"]) {
      const path = join(repoRoot, CRON_ROUTE_DIR, dir, file);
      if (existsSync(path)) sources.push(path);
    }
  }
  const missing = [];
  for (const path of sources) {
    const text = readFileSync(path, "utf8");
    for (const [, names] of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@\/lib\/cron"/g)) {
      for (const name of names.split(",")) {
        const trimmed = name.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
        if (trimmed && !exported.has(trimmed)) missing.push(`${path.replace(repoRoot + "/", "")}: ${trimmed}`);
      }
    }
  }
  assert.deepEqual(missing, [], "src/lib/cron/index.ts に export を足す(README の例どおりに書くと型エラーになる)");
});

test("vercel.json(あれば)は task.ts からの生成結果と一致する", async (t) => {
  const file = join(repoRoot, "vercel.json");
  if (!existsSync(file)) {
    t.skip("vercel.json なし(Vercel にデプロイするリポジトリは pnpm generate cron -- --plan hobby|pro で生成する)");
    return;
  }
  const tasks = scheduledCronTasks(await loadCronTasks(repoRoot));
  const { errors } = checkVercelCrons(JSON.parse(readFileSync(file, "utf8")).crons ?? [], tasks);
  assert.deepEqual(errors, []);
});

// ---- task.override.ts(一時ディレクトリに cron フォルダを作って検査) ----

async function withCronFixture(files, fn) {
  const root = mkdtempSync(join(tmpdir(), "cron-wiring-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      const file = join(root, CRON_ROUTE_DIR, rel);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, body);
    }
    return await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const taskSource = (name, schedule) =>
  `export const cronTask = { name: "${name}", description: "d", schedule: "${schedule}", run: async () => ({}) };\n`;

test("task.override.ts: 空(空白とコメントだけ)は不在と同じ(多段で下の Tier が親の上書きを空にしてよい、D34 K1)", async () => {
  await withCronFixture(
    {
      "a-task/task.ts": taskSource("a-task", "0 18 * * *"),
      "a-task/task.override.ts": "",
      "b-task/task.ts": taskSource("b-task", "5 18 * * *"),
      "b-task/task.override.ts": "// 親の上書きを外した(下の Tier)\n/* 空 */\n",
    },
    async (root) => {
      const tasks = await loadCronTasks(root);
      assert.deepEqual(
        tasks.map(({ name, schedule, overridden }) => ({ name, schedule, overridden })),
        [
          { name: "a-task", schedule: "0 18 * * *", overridden: false },
          { name: "b-task", schedule: "5 18 * * *", overridden: false },
        ],
      );
    },
  );
});

test("task.override.ts: schedule を差し替え、disabled のタスクは定期実行から外す", async () => {
  await withCronFixture(
    {
      "a-task/task.ts": taskSource("a-task", "0 18 * * *"),
      "a-task/task.override.ts": 'export const cronOverride = { schedule: "0 20 * * *" };\n',
      "b-task/task.ts": taskSource("b-task", "5 18 * * *"),
      "b-task/task.override.ts": "export const cronOverride = { disabled: true };\n",
      "c-task/task.ts": taskSource("c-task", "10 18 * * *"),
    },
    async (root) => {
      const tasks = await loadCronTasks(root);
      assert.deepEqual(
        tasks.map(({ name, schedule, disabled, overridden }) => ({ name, schedule, disabled, overridden })),
        [
          { name: "a-task", schedule: "0 20 * * *", disabled: false, overridden: true },
          { name: "b-task", schedule: "5 18 * * *", disabled: true, overridden: true },
          { name: "c-task", schedule: "10 18 * * *", disabled: false, overridden: false },
        ],
      );
      assert.deepEqual(
        buildVercelCrons(scheduledCronTasks(tasks), "pro").map((entry) => entry.path),
        ["/api/cron/a-task", "/api/cron/c-task"],
      );
    },
  );
});

test("機能の門: 住所 /api/cron/<name> が閉じたタスクは closedBy が付き、定期実行(vercel.json の生成と検査)から外れる", async () => {
  await withCronFixture(
    {
      "a-task/task.ts": taskSource("a-task", "0 18 * * *"),
      "b-task/task.ts": taskSource("b-task", "5 18 * * *"),
      "c-task/task.ts": taskSource("c-task", "* * * * *"),
    },
    async (root) => {
      const closedBy = (pathname) => (pathname === "/api/cron/b-task" ? "wallet" : null);
      const tasks = await loadCronTasks(root, { closedBy });
      assert.deepEqual(
        tasks.map(({ name, closedBy: rule }) => ({ name, rule })),
        [
          { name: "a-task", rule: null },
          { name: "b-task", rule: "wallet" },
          { name: "c-task", rule: null },
        ],
      );
      const scheduled = scheduledCronTasks(tasks);
      for (const plan of ["pro", "hobby"]) {
        const crons = buildVercelCrons(scheduled, plan);
        assert.deepEqual(crons.map((entry) => entry.path), ["/api/cron/a-task", "/api/cron/c-task"], plan);
        assert.deepEqual(checkVercelCrons(crons, scheduled).errors, [], `${plan}: 生成と検査は同じ一覧で一致する`);
      }
      const reopened = await loadCronTasks(root, { closedBy: () => null });
      assert.ok(
        checkVercelCrons(buildVercelCrons(scheduled, "pro"), scheduledCronTasks(reopened)).errors.length > 0,
        "機能を開いたのに再生成していない vercel.json は検査で止まる",
      );
    },
  );
});

test("機能の門: 既定の判定は門番の gate.path(今の config。登録端末は既定で閉)", async () => {
  assert.equal(gateClosedBy("/api/cron/paired-device-pairings-prune"), "pairedDevice");
  assert.equal(gateClosedBy("/api/cron/audit-log-prune"), null);
  const tasks = await loadCronTasks(repoRoot);
  assert.equal(tasks.find((task) => task.name === "paired-device-pairings-prune")?.closedBy, "pairedDevice");
});

test("createCronRoute: 依存の gate が閉と答えたら認証の後・enabled と本体の前に skipped(reason closed)、依存なしは今と同じ", async () => {
  const saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "s";
  try {
    const req = (auth = "Bearer s") => new Request("http://localhost/api/cron/x-task", { headers: { authorization: auth } });
    const calls = [];
    const task = {
      name: "x-task",
      description: "d",
      schedule: "0 18 * * *",
      enabled: () => {
        calls.push("enabled");
        return true;
      },
      run: async () => {
        calls.push("run");
        return { done: 1 };
      },
    };
    const seen = [];
    const closedGate = { isClosed: (pathname) => (seen.push(pathname), true) };

    assert.equal((await createCronTaskRoute(task, { gate: closedGate })(req("Bearer x"))).status, 401, "認証が先");
    assert.deepEqual(seen, []);

    const closed = await createCronTaskRoute(task, { gate: closedGate })(req());
    assert.equal(closed.status, 200);
    assert.deepEqual(await closed.json(), { ok: true, skipped: true, reason: "closed" });
    assert.deepEqual(seen, ["/api/cron/x-task"], "住所はタスクの名前から組む");
    assert.deepEqual(calls, [], "閉なら enabled も本体も呼ばない");

    const open = await createCronTaskRoute(task, { gate: { isClosed: () => false } })(req());
    assert.deepEqual(await open.json(), { ok: true, done: 1 });
    assert.deepEqual(calls, ["enabled", "run"]);

    calls.length = 0;
    const plain = await createCronTaskRoute(task)(req());
    assert.deepEqual(await plain.json(), { ok: true, done: 1 }, "依存なしは今と同じ");

    const disabled = await createCronRoute({ name: "y-task", handler: async () => ({}), enabled: () => false }, { gate: { isClosed: () => false } })(req());
    assert.deepEqual(await disabled.json(), { ok: true, skipped: true, reason: "disabled" });
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
});

test("task.override.ts: 不正な cron 式・未知の項目・task.ts の無いフォルダは失敗", async () => {
  await withCronFixture(
    { "a-task/task.ts": taskSource("a-task", "0 18 * * *"), "a-task/task.override.ts": 'export const cronOverride = { schedule: "daily" };\n' },
    async (root) => assert.rejects(loadCronTasks(root), /task\.override\.ts の schedule/),
  );
  await withCronFixture(
    { "a-task/task.ts": taskSource("a-task", "0 18 * * *"), "a-task/task.override.ts": "export const cronOverride = { enabled: false };\n" },
    async (root) => assert.rejects(loadCronTasks(root), /未知の項目/),
  );
  await withCronFixture(
    { "gone/task.override.ts": "export const cronOverride = { disabled: true };\n" },
    async (root) => assert.rejects(loadCronTasks(root), /task\.override\.ts だけが残っている/),
  );
});

test("旧名の override.ts が残っていれば task.override.ts への改名を案内して止まる(空でも)", async () => {
  for (const body of ['export const cronOverride = { disabled: true };\n', ""]) {
    await withCronFixture(
      { "a-task/task.ts": taskSource("a-task", "0 18 * * *"), "a-task/override.ts": body },
      async (root) =>
        assert.rejects(loadCronTasks(root), (error) => {
          assert.match(error.message, /a-task\/override\.ts は旧名です。task\.override\.ts に改名してください/);
          assert.match(error.message, /git mv src\/app\/api\/cron\/a-task\/override\.ts src\/app\/api\/cron\/a-task\/task\.override\.ts/);
          return true;
        }),
    );
  }
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

test("task.override.ts: fork の今の形(boardgame-site の 4 本 = import type CronTaskOverride + { disabled: true })が通り、書ける鍵は宣言 src/lib/cron/extensionPoints.ts から", async () => {
  const forkShape = 'import type { CronTaskOverride } from "@/lib/cron";\n\nexport const cronOverride: CronTaskOverride = {\n  disabled: true,\n};\n';
  await withCronFixture(
    { "a-task/task.ts": taskSource("a-task", "0 18 * * *"), "a-task/task.override.ts": forkShape },
    async (root) => {
      const [task] = await loadCronTasks(root);
      assert.equal(task.disabled, true);
      assert.equal(task.overridden, true);
    },
  );
  await withCronFixture(
    { "a-task/task.ts": taskSource("a-task", "0 18 * * *"), "a-task/task.override.ts": "export const cronOverride = { run: 1 };\n" },
    async (root) => assert.rejects(loadCronTasks(root), /未知の項目があります: run（書けるのは schedule \/ disabled）/),
  );
});
