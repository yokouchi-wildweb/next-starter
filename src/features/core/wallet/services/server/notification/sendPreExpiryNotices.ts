// src/features/core/wallet/services/server/notification/sendPreExpiryNotices.ts
// 失効予告（失効の N 日前にユーザーへ知らせる）
//
// - 通貨ごとに wallet-expiration.config.ts の notice.preExpiry（段の配列）に従って送る。
//   sweepEnabled: true の通貨のみ（没収しない通貨に「失効します」と告げないため）
// - 段ごとに「ここまでの失効日時は予告済み」の水位をチェックポイント（cron_checkpoints）で持つ。
//   毎回の対象は (水位, 今日 + daysBefore 日の終わり]。cron が止まっていた日があっても、
//   次回の窓が自動的に広がって回収される
// - 窓の上限は暦日単位（WALLET_EXPIRATION_NOTICE_SETTINGS.dateTimeZone）。同じ日に失効する
//   ロットはその日の合計額として1通にまとまり、cron を毎時で回しても窓が動くのは1日1回
// - 段を初めて実行するときの水位は「1つ短い段の窓の上限」（最短の段は現在時刻）。
//   各段が自分の帯だけを担当するので、有効化した当日に同じユーザーへ全段ぶんが届くことはない

import { runBudgetedBatches } from "@/lib/cron";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import {
  WALLET_EXPIRATION_CONFIG,
  WALLET_EXPIRATION_NOTICE_SETTINGS,
} from "@/config/app/wallet-expiration.config";
import { advanceCheckpoint, findCheckpoint } from "@/features/core/cronCheckpoint/services/server";
import { MESSAGING_SOURCES } from "@/features/core/messaging/constants/sources";
import { getPreExpiryNoticeStages } from "@/features/core/wallet/utils/expiration";
import {
  endOfLocalDayAfter,
  formatLocalDate,
  toLocalDateKey,
} from "@/features/core/wallet/utils/expirationNoticeDate";
import { findUsersWithExpiringLots } from "../lots/findUsersWithExpiringLots";
import { formatAmount } from "./adjustmentNotificationTemplate";
import {
  ExpirationNoticeStopError,
  createExpirationNoticeCounts,
  sendExpirationNoticeJobs,
  type ExpirationNoticeCounts,
  type ExpirationNoticeJob,
  type ExpirationNoticeRunState,
} from "./expirationNoticeSender";

/** 1ページの件数（締切は送信の合間にも確認するので、ページが大きくても締切を超えない） */
const PAGE_SIZE = 200;

export type SendPreExpiryNoticesResult = ExpirationNoticeCounts & {
  /** 対象を全て処理しきった（false = 締切または打ち切りで次回に持ち越し） */
  exhausted: boolean;
  /** 連続失敗で打ち切った */
  aborted: boolean;
};

function checkpointName(walletType: WalletType, daysBefore: number): string {
  return `wallet-expiration-notice:pre:${walletType}:${daysBefore}`;
}

/**
 * 失効予告を送る。締切までに終わらなかった段は水位を進めず、次回実行が同じ窓をやり直す
 * （送信済みの相手は冪等性キーで除外されるので二重には届かない）。
 * 冪等性キーは「通貨 × 段 × ユーザー × 最も早い失効日」。同じ日の失効について同じ段は1回だけ届く。
 */
export async function sendPreExpiryNotices(options: {
  deadline: Date;
  state?: ExpirationNoticeRunState;
}): Promise<SendPreExpiryNoticesResult> {
  const counts = createExpirationNoticeCounts();
  const state = options.state ?? { consecutiveFailures: 0 };
  const { dateTimeZone } = WALLET_EXPIRATION_NOTICE_SETTINGS;
  // 窓は実行の最初に確定し、全ページで同じ値を使う（ページ間で窓がずれると境界の対象が欠落・重複する）
  const now = new Date();
  let exhausted = true;

  for (const walletType of Object.keys(WALLET_EXPIRATION_CONFIG) as WalletType[]) {
    const stages = getPreExpiryNoticeStages(walletType);
    const { label } = CURRENCY_CONFIG[walletType];

    for (const [index, stage] of stages.entries()) {
      const name = checkpointName(walletType, stage.daysBefore);
      const expiresTo = endOfLocalDayAfter(now, stage.daysBefore, dateTimeZone);

      let expiresFrom: Date;
      const checkpoint = await findCheckpoint(name);
      if (checkpoint) {
        expiresFrom = checkpoint.checkpointAt;
      } else {
        const shorter = stages[index - 1];
        expiresFrom = shorter ? endOfLocalDayAfter(now, shorter.daysBefore, dateTimeZone) : now;
        await advanceCheckpoint(name, expiresFrom);
      }
      if (expiresTo.getTime() <= expiresFrom.getTime()) continue;

      try {
        const result = await runBudgetedBatches<ExpirationNoticeJob, string | null>({
          deadline: options.deadline,
          fetchNext: async (cursor) => {
            const page = await findUsersWithExpiringLots({
              walletType,
              expiresFrom,
              expiresTo,
              cursor: cursor ?? null,
              limit: PAGE_SIZE,
            });
            if (page.items.length === 0) return null;
            return {
              items: page.items.map((item) => ({
                userId: item.userId,
                idempotencyKey: [
                  "wallet-expiring",
                  walletType,
                  stage.daysBefore,
                  item.userId,
                  toLocalDateKey(item.earliestExpiresAt, dateTimeZone),
                ].join(":"),
                channels: stage.channels,
                copy: stage.copy,
                vars: {
                  currencyLabel: label,
                  amount: formatAmount(item.totalExpiring, walletType),
                  expiresOn: formatLocalDate(item.earliestExpiresAt, dateTimeZone),
                  daysBefore: String(stage.daysBefore),
                },
                source: MESSAGING_SOURCES.WALLET_EXPIRATION_PRE_NOTICE,
              })),
              cursor: page.nextCursor,
              done: page.nextCursor === null,
            };
          },
          processChunk: (jobs) => sendExpirationNoticeJobs(jobs, counts, state, options.deadline),
        });

        if (result.exhausted) {
          await advanceCheckpoint(name, expiresTo);
        } else {
          exhausted = false;
        }
      } catch (error) {
        if (error instanceof ExpirationNoticeStopError) {
          return { ...counts, exhausted: false, aborted: error.reason === "aborted" };
        }
        throw error;
      }
    }
  }

  return { ...counts, exhausted, aborted: false };
}
