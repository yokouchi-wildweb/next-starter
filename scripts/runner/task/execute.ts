// scripts/runner/task/execute.ts
// 1 回の実行の流れ(記録・止める鍵・結果不明・dry-run・requestId)。記録の置き場は store で受ける(本物は task_runs、テストは記憶の中)。
//
// 流れ: 止める鍵を求める(使い方の誤り = failed の行を書いて終わり)→ dry-run でなければ鍵を持つ行を探す(あれば拒否、行は書かない)
//   → running の行を書く(書けなければ走らせない)→ runAsSystem({ requestId: 行の id }) の中で走らせる → 結果を書く。
// 結果: 成功 = succeeded | TaskNotStartedError = failed(鍵を取らない)| ほかの失敗 = 鍵があれば unknown、無ければ failed | dry-run の失敗 = failed。
// dry-run(引数 --dry-run)は鍵を取らず、鍵に止められない。
// git に入れない移行(local): 本実行は同じ名前・同じ中身(file_hash)の成功した dry-run があることが条件(無ければ needs-dry-run)。
//   中身の全文を dry-run も本実行も行の source に残す。
// 利用者: scripts/runner/task/run.ts

import type { TaskRunKind, TaskRunStatus } from "@/features/taskRun/constants";
import type { TaskRun, TaskRunFinishInput, TaskRunStartInput } from "@/features/taskRun/entities/model";

import type { RunMeta } from "./record";

export type TaskRunStore = {
  findKeyHolders(keys: readonly string[]): Promise<TaskRun[]>;
  /** 同じ名前・同じ中身の成功した dry-run の行(git に入れない移行の本実行の条件) */
  findDryRunOf(name: string, fileHash: string): Promise<TaskRun | null>;
  start(input: TaskRunStartInput): Promise<{ id: string }>;
  finish(id: string, input: TaskRunFinishInput): Promise<unknown>;
};

export type ExecuteInput = {
  name: string;
  kind: TaskRunKind;
  args: string[];
  meta: RunMeta;
  /** 止める鍵(移行は migration:<notice>:<名前>、タスクは stopKeys(args)、cron は無し) */
  stopKeys: () => string[] | Promise<string[]>;
  run: () => Promise<Record<string, unknown>>;
  /** 監査の文脈を system にして走らせる(requestId = 記録の行の id) */
  asSystem: <T>(requestId: string, fn: () => Promise<T>) => Promise<T>;
  store: TaskRunStore;
  /** git に入れない移行(.local.ts)の中身。本実行の条件と記録の全文に使う */
  local?: { fileHash: string; source: string };
};

export type ExecuteOutcome =
  | { kind: "ran"; runId: string; status: Exclude<TaskRunStatus, "running">; result?: Record<string, unknown>; error?: string; recordWritten: boolean }
  | { kind: "refused"; keys: string[]; holders: TaskRun[] }
  | { kind: "needs-dry-run"; fileHash: string }
  | { kind: "not-recorded"; error: string };

export const isDryRun = (args: readonly string[]): boolean => args.includes("--dry-run");

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
/** 書き込み前に止まった印(@/lib/task の TaskNotStartedError。読み込みの経路が違っても名前で分かる) */
const notStarted = (error: unknown): boolean => error instanceof Error && error.name === "TaskNotStartedError";

/** 1 回の実行。記録の行が書けなければ走らせない(not-recorded) */
export async function executeTask(input: ExecuteInput): Promise<ExecuteOutcome> {
  const { name, kind, args, meta, store } = input;
  const dryRun = isDryRun(args);
  const base = { name, kind, args, dryRun, ...meta, source: input.local?.source ?? null };

  let keys: string[];
  try {
    keys = [...new Set(await input.stopKeys())];
  } catch (error) {
    // 鍵を求める段 = 書き込みの前。失敗の行だけ書く
    let runId: string;
    try {
      runId = (await store.start({ ...base, stopKeys: [] })).id;
    } catch (recordError) {
      return { kind: "not-recorded", error: messageOf(recordError) };
    }
    const recordWritten = await finishSafely(store, runId, { status: "failed", error: messageOf(error) });
    return { kind: "ran", runId, status: "failed", error: messageOf(error), recordWritten };
  }

  if (!dryRun && keys.length > 0) {
    const holders = await store.findKeyHolders(keys);
    if (holders.length > 0) return { kind: "refused", keys, holders };
  }

  if (!dryRun && input.local && !(await store.findDryRunOf(name, input.local.fileHash))) {
    return { kind: "needs-dry-run", fileHash: input.local.fileHash };
  }

  let runId: string;
  try {
    runId = (await store.start({ ...base, stopKeys: keys })).id;
  } catch (error) {
    return { kind: "not-recorded", error: messageOf(error) };
  }

  try {
    const result = await input.asSystem(runId, input.run);
    const recordWritten = await finishSafely(store, runId, { status: "succeeded", result });
    return { kind: "ran", runId, status: "succeeded", result, recordWritten };
  } catch (error) {
    const status: "failed" | "unknown" = notStarted(error) || dryRun || keys.length === 0 ? "failed" : "unknown";
    const recordWritten = await finishSafely(store, runId, { status, error: messageOf(error) });
    return { kind: "ran", runId, status, error: messageOf(error), recordWritten };
  }
}

/** 結果を書く。書けなければ false(行は running のまま残り、結果不明と同じに鍵を持つ) */
async function finishSafely(store: TaskRunStore, runId: string, input: TaskRunFinishInput): Promise<boolean> {
  try {
    await store.finish(runId, input);
    return true;
  } catch {
    return false;
  }
}
