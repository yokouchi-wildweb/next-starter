// scripts/runner/task/execute.test.ts — pnpm test scripts/runner/task/execute.test.ts
// 1 回の実行の流れ(execute.ts)を記憶の中の置き場で確かめる(DB には触らない。本物の task_runs は taskRunStore.db.test.ts)。
// 記録の行・止める鍵・結果不明・書き込み前の失敗・dry-run・requestId・記録が書けない時に走らせないこと。

import assert from "node:assert/strict";
import { test } from "node:test";

import { TaskNotStartedError } from "@/lib/task";
import type { TaskRun } from "@/features/taskRun/entities/model";

import { type ExecuteInput, executeTask, type TaskRunStore } from "./execute";
import { invocationOf } from "./invocation";

const META = { gitSha: "abc", gitDirty: false, actor: "me@host", stage: "development", dbTarget: "db.example/app", fileHash: "h" };

/** 記憶の中の置き場(本物と同じ規則: 鍵を持つ = dry-run でない running / succeeded / unknown) */
function memoryStore(): TaskRunStore & { rows: TaskRun[]; failStart?: boolean } {
  const rows: TaskRun[] = [];
  const store = {
    rows,
    failStart: false,
    async findKeyHolders(keys: readonly string[]) {
      return rows.filter((r) => !r.dryRun && ["running", "succeeded", "unknown"].includes(r.status) && r.stopKeys.some((k) => keys.includes(k)));
    },
    async findDryRunOf(name: string, fileHash: string) {
      return rows.find((r) => r.name === name && r.fileHash === fileHash && r.dryRun && r.status === "succeeded") ?? null;
    },
    async start(input: Parameters<TaskRunStore["start"]>[0]) {
      if (store.failStart) throw new Error("表 task_runs がありません");
      const row: TaskRun = { ...input, source: input.source ?? null, id: `run-${rows.length + 1}`, status: "running", result: null, error: null, startedAt: new Date(), finishedAt: null, resolvedAt: null };
      rows.push(row);
      return row;
    },
    async finish(id: string, input: Parameters<TaskRunStore["finish"]>[1]) {
      const row = rows.find((r) => r.id === id);
      if (row && row.status === "running") Object.assign(row, { status: input.status, result: input.result ?? null, error: input.error ?? null, finishedAt: new Date() });
      return row ?? null;
    },
  };
  return store;
}

function input(store: TaskRunStore, over: Partial<ExecuteInput> = {}): ExecuteInput {
  return {
    name: "wallet:lots-init",
    kind: "task",
    args: [],
    meta: META,
    stopKeys: () => ["wallet-lots:coin"],
    run: async () => ({ done: 1 }),
    asSystem: async (_requestId, fn) => fn(),
    store,
    ...over,
  };
}

test("成功: running の行を書いてから走らせ、succeeded と結果を書く。requestId は行の id", async () => {
  const store = memoryStore();
  const seen: string[] = [];
  const out = await executeTask(input(store, { asSystem: async (requestId, fn) => (seen.push(requestId), fn()) }));
  assert.equal(out.kind, "ran");
  assert.equal(store.rows.length, 1);
  const [row] = store.rows;
  assert.deepEqual([row.status, row.result, row.stopKeys, row.dryRun, row.actor, row.gitSha], ["succeeded", { done: 1 }, ["wallet-lots:coin"], false, "me@host", "abc"]);
  assert.deepEqual(seen, [row.id]);
});

test("止める鍵: 成功済み・結果不明・実行中の行と同じ鍵は拒否(行は書かない)、失敗の行は鍵を持たない", async () => {
  for (const status of ["succeeded", "unknown", "running"] as const) {
    const store = memoryStore();
    await executeTask(input(store));
    store.rows[0].status = status;
    let ran = false;
    const out = await executeTask(input(store, { name: "wallet:lots-init-from-history", run: async () => ((ran = true), {}) }));
    assert.equal(out.kind, "refused", status);
    assert.equal(ran, false);
    assert.equal(store.rows.length, 1);
  }
  const store = memoryStore();
  await executeTask(input(store, { run: async () => { throw new TaskNotStartedError("使い方"); } }));
  assert.equal(store.rows[0].status, "failed");
  assert.equal((await executeTask(input(store))).kind, "ran");
});

test("結果不明: 鍵のある実行が走り出してから落ちたら unknown(二度目は拒否)、書き込み前の印なら failed", async () => {
  const store = memoryStore();
  const out = await executeTask(input(store, { run: async () => { throw new Error("途中で切れた"); } }));
  assert.ok(out.kind === "ran" && out.status === "unknown");
  assert.equal((await executeTask(input(store))).kind, "refused");
  const store2 = memoryStore();
  const out2 = await executeTask(input(store2, { run: async () => { throw new TaskNotStartedError("--wallet-type が無い"); } }));
  assert.ok(out2.kind === "ran" && out2.status === "failed");
});

test("鍵の無いタスク(と名指しの定期タスク)の失敗は failed、二度目も走る", async () => {
  const store = memoryStore();
  const plain = { name: "expire-pending-purchases", kind: "cron" as const, stopKeys: () => [] };
  await executeTask(input(store, { ...plain, run: async () => { throw new Error("x"); } }));
  assert.equal(store.rows[0].status, "failed");
  await executeTask(input(store, plain));
  await executeTask(input(store, plain));
  assert.deepEqual(store.rows.map((r) => [r.kind, r.status]), [["cron", "failed"], ["cron", "succeeded"], ["cron", "succeeded"]]);
});

test("止める鍵を求める段の失敗(使い方の誤り)は failed の行だけ書き、走らせない", async () => {
  const store = memoryStore();
  let ran = false;
  const out = await executeTask(input(store, { stopKeys: () => { throw new TaskNotStartedError("--wallet-type か --all"); }, run: async () => ((ran = true), {}) }));
  assert.ok(out.kind === "ran" && out.status === "failed");
  assert.equal(ran, false);
  assert.deepEqual([store.rows[0].status, store.rows[0].stopKeys, store.rows[0].error], ["failed", [], "--wallet-type か --all"]);
});

test("dry-run: 鍵に止められず、鍵を取らない(印は dry_run、失敗は failed)", async () => {
  const store = memoryStore();
  await executeTask(input(store));
  const dry = await executeTask(input(store, { args: ["--dry-run"] }));
  assert.ok(dry.kind === "ran" && dry.status === "succeeded");
  assert.equal(store.rows[1].dryRun, true);
  const fresh = memoryStore();
  await executeTask(input(fresh, { args: ["--dry-run"], run: async () => { throw new Error("x"); } }));
  assert.equal(fresh.rows[0].status, "failed");
  assert.equal((await executeTask(input(fresh))).kind, "ran", "dry-run の行は鍵を持たない");
});

test("記録の行が書けなければ走らせない", async () => {
  const store = memoryStore();
  store.failStart = true;
  let ran = false;
  const out = await executeTask(input(store, { run: async () => ((ran = true), {}) }));
  assert.equal(out.kind, "not-recorded");
  assert.equal(ran, false);
});

test("記録を書くのは名指しの 1 回だけ: pnpm task <名前>(定期タスクの名前も)は書く、--due・--list・--resolve は書かない(L1.31)", () => {
  assert.deepEqual(invocationOf(["expire-pending-purchases"]), { kind: "named", name: "expire-pending-purchases", rest: [], recorded: true });
  assert.deepEqual(invocationOf(["wallet:lots-init", "--all"]), { kind: "named", name: "wallet:lots-init", rest: ["--all"], recorded: true });
  assert.deepEqual(invocationOf(["--due"]), { kind: "due", recorded: false });
  assert.equal(invocationOf(["--list"]).recorded, false);
  assert.equal(invocationOf([]).recorded, false);
  assert.deepEqual(invocationOf(["--resolve", "id", "failed"]), { kind: "resolve", rest: ["id", "failed"], recorded: false });
});

test("git に入れない移行: 同じ中身の dry-run が成功するまで本実行しない、全文を両方の行に残す、同じ中身は二度と本実行しない", async () => {
  const store = memoryStore();
  const local = { fileHash: "hash-1", source: "export const task = {};\n" };
  const keys = () => ["migration:local:wallet:fix:hash-1"];
  const base = { name: "wallet:fix", kind: "migration" as const, stopKeys: keys, local, meta: { ...META, fileHash: "hash-1" } };
  assert.deepEqual(await executeTask(input(store, base)), { kind: "needs-dry-run", fileHash: "hash-1" });
  assert.equal(store.rows.length, 0);
  const dry = await executeTask(input(store, { ...base, args: ["--dry-run"] }));
  assert.ok(dry.kind === "ran" && dry.status === "succeeded");
  const real = await executeTask(input(store, base));
  assert.ok(real.kind === "ran" && real.status === "succeeded");
  assert.deepEqual(store.rows.map((r) => [r.dryRun, r.source]), [[true, local.source], [false, local.source]]);
  assert.equal((await executeTask(input(store, base))).kind, "refused", "同じ中身の本実行は二度目を拒否");
  const edited = { fileHash: "hash-2", source: "changed\n" };
  assert.deepEqual(await executeTask(input(store, { ...base, local: edited, stopKeys: () => ["migration:local:wallet:fix:hash-2"], meta: { ...META, fileHash: "hash-2" } })), { kind: "needs-dry-run", fileHash: "hash-2" }, "中身を変えたら dry-run からやり直し");
});

test("ふつうのタスクの行の source は null", async () => {
  const store = memoryStore();
  await executeTask(input(store));
  assert.equal(store.rows[0].source, null);
});
