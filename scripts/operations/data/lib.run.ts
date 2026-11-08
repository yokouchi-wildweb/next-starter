// scripts/operations/data/lib.run.ts
// pnpm ops data の書き込み(import / update / delete)を、pnpm task と同じ実行の記録の流れで走らせる(AMENDMENT 1 = a):
// - task_runs に記録(kind data、名前 data:<command>:<domain>、引数)。runId を監査の requestId に(runAsSystem)
// - 止める鍵 data:<command>:<domain>:<ファイルの中身(--ids なら id の並び)の sha256>: 同じ中身を二度当てない
// - --dry-run は記録するが鍵を取らない(確かめだけ)。書く前に止めた(DataUsageError)とサービスが拒んだ(DomainError、1 回の呼び出しは
//   全部か無しなので何も書いていない)= failed で鍵を取らない。ほかの失敗(接続が切れた等)は結果不明 = 鍵を持つ
// 流れは scripts/runner/task/execute.ts(executeTask)・記録は store.ts・メタは record.ts を共有する(二重に作らない)

import { createHash } from "node:crypto";
import path from "node:path";

import { TaskNotStartedError } from "@/lib/task";

import { executeTask, isDryRun } from "../../runner/task/execute";
import { asSystem, requireDatabase } from "../../runner/task/prepare";
import { collectRunMeta } from "../../runner/task/record";
import { dbTaskRunStore } from "../../runner/task/store";
import { DataUsageError } from "./lib.args";

const REPO = path.resolve(import.meta.dirname, "../../..");

export const contentHash = (content: string): string => createHash("sha256").update(content).digest("hex");

export const dataRunName = (command: string, domain: string): string => `data:${command}:${domain}`;
export const dataStopKey = (command: string, domain: string, content: string): string => `${dataRunName(command, domain)}:${contentHash(content)}`;

const log = (level: "info" | "error", payload: Record<string, unknown>) =>
  (level === "error" ? console.error : console.log)(JSON.stringify({ level, scope: "ops-data", ...payload }));

/**
 * 記録つきで書く。work は DataUsageError(書く前に止めた)か結果を返す。終了コードを返す
 * @param content 鍵に使う中身(ファイルの中身、--ids なら並べた id)
 */
export async function runRecordedWrite(input: {
  command: "import" | "update" | "delete";
  domain: string;
  args: string[];
  content: string;
  work: () => Promise<Record<string, unknown>>;
}): Promise<number> {
  await requireDatabase(`pnpm ops data ${input.command}`);
  const name = dataRunName(input.command, input.domain);
  const meta = { ...collectRunMeta(REPO, null), fileHash: contentHash(input.content) };
  const started = Date.now();
  const outcome = await executeTask({
    name,
    kind: "data",
    args: input.args,
    meta,
    stopKeys: () => [dataStopKey(input.command, input.domain, input.content)],
    run: async () => {
      try {
        return await input.work();
      } catch (error) {
        // 書く前に止めた = 鍵を取らずに failed(直して打ち直せる)
        if (error instanceof DataUsageError) throw new TaskNotStartedError(error.message);
        // サービスの DomainError(検証・守りで拒否): 書き込みは 1 回の呼び出し = 1 つの transaction / 1 文なので何も書いていない
        const { DomainError } = await import("@/lib/errors/domainError");
        if (error instanceof DomainError) throw new TaskNotStartedError(error.message);
        throw error;
      }
    },
    asSystem: (requestId, fn) => asSystem(fn, requestId),
    store: await dbTaskRunStore(),
  });
  const durationMs = Date.now() - started;
  if (outcome.kind === "not-recorded") {
    log("error", { run: name, ok: false, error: `実行の記録(task_runs)が書けないので書きません: ${outcome.error}` });
    return 1;
  }
  if (outcome.kind === "refused") {
    log("error", {
      run: name,
      ok: false,
      refused: true,
      keys: outcome.keys,
      holders: outcome.holders.map((r) => ({ runId: r.id, status: r.status, startedAt: r.startedAt.toISOString() })),
      error: "同じ中身の書き込みが成功済み・結果不明・実行中です。書きません(確かめた結果は pnpm task --resolve <runId> succeeded|failed)",
    });
    return 1;
  }
  if (outcome.kind === "needs-dry-run") return 1;
  const ok = outcome.status === "succeeded";
  log(ok ? "info" : "error", { run: name, ok, status: outcome.status, runId: outcome.runId, dryRun: isDryRun(input.args), durationMs, ...(ok ? outcome.result : { error: outcome.error }) });
  return ok ? 0 : 1;
}

/** 書く前に止めた理由を出して終わる(記録の無い誤り: ドメイン・許可・引数) */
export function failUsage(error: unknown): number {
  if (error instanceof DataUsageError) {
    console.error(`✗ ${error.message}`);
    return 1;
  }
  throw error;
}
