// src/features/core/messaging/services/server/sweep/sweep.ts
//
// 送信の掃き出し(cron messaging-send-sweep)と「続きを送る」の本体(部品 deps を受ける。結びは index.ts)。
// 1 回の実行: sending のまま lease が切れた行 → unknown / 予約の時刻が来た回 → processing /
//   展開の続き(expandChunksPerRun 束まで)/ 送る時刻が来た配達(lease + FOR UPDATE SKIP LOCKED、予算の中)/ 終えた回を閉じる
// cron が 1 日 1 回の環境(Vercel Hobby)では遅れるだけで壊れない(要求の中で最初の束を送り、続きは管理の「続きを送る」)

import { DomainError } from "@/lib/errors";
import { runBudgetedBatches } from "@/lib/cron";

import { completeDispatches } from "./complete";
import { expandDispatchChunk } from "./expandStep";
import { sendClaimed } from "./sendStep";
import type { MessageSweepDeps } from "./types";

const STALE_LIMIT = 1000;
const ACTIVATE_LIMIT = 100;
const COMPLETE_LIMIT = 100;

export type SendSweepResult = {
  staleToUnknown: number;
  activated: number;
  expandedChunks: number;
  claimed: number;
  sent: number;
  failed: number;
  requeued: number;
  completed: number;
  stopReason: string;
};

export async function sweepMessages(deps: MessageSweepDeps, params: { deadline: Date }): Promise<SendSweepResult> {
  const { sweep } = deps.config;
  const now = deps.now();
  const staleToUnknown = await deps.sweepStore.markStaleSending(now, STALE_LIMIT);
  const activated = await deps.sweepStore.activateScheduled(now, ACTIVATE_LIMIT);

  let expandedChunks = 0;
  while (expandedChunks < sweep.expandChunksPerRun && Date.now() < params.deadline.getTime()) {
    const done = await deps.sweepStore.expandOne(null, (dispatch) => expandDispatchChunk(deps, dispatch));
    if (!done) break;
    expandedChunks += 1;
  }

  const totals = { claimed: 0, sent: 0, failed: 0, requeued: 0 };
  const run = await runBudgetedBatches({
    deadline: params.deadline,
    fetchNext: async () => {
      const token = deps.newToken();
      const at = deps.now();
      const items = await deps.sweepStore.claimDue({
        now: at,
        limit: sweep.deliveryChunkSize,
        leaseUntil: new Date(at.getTime() + sweep.leaseSeconds * 1000),
        lockToken: token,
      });
      return { items: items.map((row) => ({ row, token })), cursor: undefined };
    },
    processChunk: async (items) => {
      const token = items[0].token;
      const result = await sendClaimed(
        deps,
        items.map((item) => item.row),
        token,
      );
      totals.claimed += result.processed;
      totals.sent += result.sent;
      totals.failed += result.failed;
      totals.requeued += result.queued;
    },
  });

  const completed = await completeDispatches(deps, { limit: COMPLETE_LIMIT });
  return { staleToUnknown, activated, expandedChunks, ...totals, completed, stopReason: run.stopReason };
}

export type ContinueSendingResult = { expanded: boolean; claimed: number; sent: number; failed: number; completed: boolean };

/**
 * 1 つの回を 1 束だけ進める(展開の続き 1 束 + 送る時刻が来た配達 1 束 + 閉じられるなら閉じる)。
 * 管理の「続きを送る」(API・画面は管理の指令)と cron の遅い環境のため。
 * @throws DomainError(404) 回が無い / DomainError(409) 進められない状態(processing 以外)
 */
export async function continueDispatch(deps: MessageSweepDeps, dispatchId: string): Promise<ContinueSendingResult> {
  const [dispatch] = await deps.sweepStore.findDispatches([dispatchId]);
  if (!dispatch) throw new DomainError("送信記録が見つかりません", { status: 404 });
  if (dispatch.status !== "processing") {
    throw new DomainError("この送信は続きを送れる状態ではありません", { status: 409 });
  }
  const expanded = await deps.sweepStore.expandOne(dispatchId, (row) => expandDispatchChunk(deps, row));
  const token = deps.newToken();
  const now = deps.now();
  const rows = await deps.sweepStore.claimDue({
    now,
    limit: deps.config.sweep.deliveryChunkSize,
    leaseUntil: new Date(now.getTime() + deps.config.sweep.leaseSeconds * 1000),
    lockToken: token,
    dispatchId,
  });
  const result = await sendClaimed(deps, rows, token);
  const completed = (await completeDispatches(deps, { limit: 1, dispatchId })) > 0;
  return { expanded, claimed: result.processed, sent: result.sent, failed: result.failed, completed };
}
