// src/features/core/wallet/scripts/tasks/lib.reverseHistoryArgs.ts
// wallet:reverse-history の引数の読み方と止める鍵(タスクの間で共有する部品。DB を読まない)

import { TaskNotStartedError } from "@/lib/task";

export const REVERSE_HISTORY_USAGE =
  'pnpm task wallet:reverse-history -- --history <行の id>[,<行の id>...] | --batch <request_batch_id> --reason "<理由>" [--dry-run]';

export type ReverseHistoryArgs = {
  historyIds?: string[];
  requestBatchId?: string;
  reason: string;
  dryRun: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const valueOf = (args: readonly string[], flag: string): string | undefined => {
  const at = args.indexOf(flag);
  if (at >= 0) return args[at + 1];
  return args.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
};

/** 引数を読む。誤りは TaskNotStartedError(書く前に止まった) */
export function readReverseHistoryArgs(args: readonly string[]): ReverseHistoryArgs {
  const fail = (why: string): never => {
    throw new TaskNotStartedError(`wallet:reverse-history: ${why}\n使い方: ${REVERSE_HISTORY_USAGE}`);
  };
  const history = valueOf(args, "--history");
  const batch = valueOf(args, "--batch");
  const reason = valueOf(args, "--reason")?.trim();
  if ((history === undefined) === (batch === undefined)) fail("--history か --batch のどちらか一方を指定してください");
  if (!reason || reason.startsWith("--")) fail("--reason \"<理由>\" は必須です(履歴と監査に残る)");
  const dryRun = args.includes("--dry-run");
  if (history !== undefined) {
    const ids = history.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) fail("--history に行の id がありません");
    const bad = ids.filter((id) => !UUID.test(id));
    if (bad.length > 0) fail(`行の id は uuid です: ${bad.join(", ")}`);
    if (new Set(ids).size !== ids.length) fail("--history の id が重なっています");
    return { historyIds: ids, reason: reason as string, dryRun };
  }
  if (!batch || !UUID.test(batch)) fail(`--batch は request_batch_id(uuid)です: ${batch ?? "(空)"}`);
  return { requestBatchId: batch, reason: reason as string, dryRun };
}

/** 止める鍵: 取り消す行ごとに 1 つ(束は行の id に開いてから渡す) */
export const reverseHistoryStopKeys = (historyIds: readonly string[]): string[] => historyIds.map((id) => `wallet-reverse:${id}`);
