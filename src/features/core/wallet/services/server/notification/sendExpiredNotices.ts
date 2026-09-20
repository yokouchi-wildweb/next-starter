// src/features/core/wallet/services/server/notification/sendExpiredNotices.ts
// 失効時の本通知（没収後にユーザーへ知らせる）
//
// - 通貨ごとに wallet-expiration.config.ts の notice.expired が設定されている場合のみ送る
// - 失効スイープとは別に動く。スイープが wallet_histories に残した per-user の失効行を
//   listExpirationResults で読み、チェックポイント（cron_checkpoints）で進捗を持つ
// - 初回実行はチェックポイントを現在時刻で登録するだけで何も送らない
//   （通知を後から有効化したとき、過去の失効分をさかのぼって一斉送信しないため）

import { runBudgetedBatches } from "@/lib/cron";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import {
  WALLET_EXPIRATION_CONFIG,
  WALLET_EXPIRATION_NOTICE_SETTINGS,
} from "@/config/app/wallet-expiration.config";
import { advanceCheckpoint, findCheckpoint } from "@/features/core/cronCheckpoint/services/server";
import { MESSAGING_SOURCES } from "@/features/core/messaging/constants/sources";
import { getExpiredNotice } from "@/features/core/wallet/utils/expiration";
import { formatLocalDate } from "@/features/core/wallet/utils/expirationNoticeDate";
import { listExpirationResults } from "../lots/listExpirationResults";
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

/**
 * 直近この時間の失効行は読まない。wallet_histories.created_at は TX 開始時刻のため、
 * commit 前の行を追い越してチェックポイントを進めると、その行が永久に読まれなくなる。
 */
const SAFETY_LAG_MS = 5 * 60 * 1000;

export type SendExpiredNoticesResult = ExpirationNoticeCounts & {
  /** 対象を全て処理しきった（false = 締切または打ち切りで次回に持ち越し） */
  exhausted: boolean;
  /** 連続失敗で打ち切った */
  aborted: boolean;
};

type PageCursor = { next: string | null; lastExpiredAt: Date };

function checkpointName(walletType: WalletType): string {
  return `wallet-expiration-notice:expired:${walletType}`;
}

/**
 * 失効時の本通知を送る。締切までに終わらなかった分は次回実行が続きから処理する。
 * 冪等: 同じ失効行には wallet_histories.id 由来のキーで1回しか送らない。
 */
export async function sendExpiredNotices(options: {
  deadline: Date;
  state?: ExpirationNoticeRunState;
}): Promise<SendExpiredNoticesResult> {
  const counts = createExpirationNoticeCounts();
  const state = options.state ?? { consecutiveFailures: 0 };
  const { dateTimeZone } = WALLET_EXPIRATION_NOTICE_SETTINGS;
  let exhausted = true;

  for (const walletType of Object.keys(WALLET_EXPIRATION_CONFIG) as WalletType[]) {
    const notice = getExpiredNotice(walletType);
    if (!notice) continue;

    const name = checkpointName(walletType);
    const checkpoint = await findCheckpoint(name);
    if (!checkpoint) {
      await advanceCheckpoint(name, new Date());
      continue;
    }

    const createdFrom = checkpoint.checkpointAt;
    const createdUntil = new Date(Date.now() - SAFETY_LAG_MS);
    if (createdUntil.getTime() <= createdFrom.getTime()) continue;

    const { label } = CURRENCY_CONFIG[walletType];

    try {
      const result = await runBudgetedBatches<ExpirationNoticeJob, PageCursor>({
        deadline: options.deadline,
        fetchNext: async (cursor) => {
          const page = await listExpirationResults({
            walletType,
            createdFrom,
            createdUntil,
            cursor: cursor?.next ?? null,
            limit: PAGE_SIZE,
          });
          const last = page.items[page.items.length - 1];
          if (!last) return null;
          return {
            items: page.items.map((item) => ({
              userId: item.userId,
              idempotencyKey: `wallet-expired:${item.historyId}`,
              channels: notice.channels,
              copy: notice.copy,
              vars: {
                currencyLabel: label,
                amount: formatAmount(item.expiredAmount, walletType),
                balanceAfter: formatAmount(item.balanceAfter, walletType),
                expiredOn: formatLocalDate(item.expiredAt, dateTimeZone),
              },
              source: MESSAGING_SOURCES.WALLET_EXPIRATION_EXPIRED_NOTICE,
            })),
            cursor: { next: page.nextCursor, lastExpiredAt: last.expiredAt },
            done: page.nextCursor === null,
          };
        },
        processChunk: (jobs) => sendExpirationNoticeJobs(jobs, counts, state, options.deadline),
        // チェックポイントはミリ秒精度のため次回実行が境界の行を読み直し得るが、送信済み除外が吸収する
        onChunkDone: async ({ cursor }) => {
          await advanceCheckpoint(name, cursor.lastExpiredAt);
        },
      });

      if (!result.exhausted) {
        exhausted = false;
      } else if (result.processed > 0) {
        // 窓を読み切ったら水位を窓の上限まで進める（次回以降、処理済みの行を読み直さない）
        await advanceCheckpoint(name, createdUntil);
      }
    } catch (error) {
      if (error instanceof ExpirationNoticeStopError) {
        return { ...counts, exhausted: false, aborted: error.reason === "aborted" };
      }
      throw error;
    }
  }

  return { ...counts, exhausted, aborted: false };
}
