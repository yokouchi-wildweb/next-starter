// src/features/core/wallet/services/server/notification/sendWalletExpirationNotices.ts
// 失効通知（予告 + 本通知）の cron タスク本体
//
// - 通知の設定（wallet-expiration.config.ts の notice）がどの通貨にも無ければ、クエリを発行せず即終了
// - 失効スイープ（wallet-expire-lots）とは別の cron。送信は外部通信で時間がかかるため、
//   没収の実行時間とウォレット行ロックに影響させない
// - 時間予算は本通知と予告で半分ずつ。本通知が大量に滞留していても、期日のある予告が後回しに
//   ならないようにするため。予告が早く終わって時間が余れば、残りを本通知に回す
// - 予告と本通知を別々の cron に分けたいプロジェクトは、sendPreExpiryNotices / sendExpiredNotices を
//   それぞれ呼ぶルートを自前で用意すればよい

import { createDeadline } from "@/lib/cron";
import { runAsSystem } from "@/lib/audit";
import type { WalletType } from "@/config/app/currency.config";
import { WALLET_EXPIRATION_CONFIG } from "@/config/app/wallet-expiration.config";
import { getExpiredNotice, getPreExpiryNoticeStages } from "@/features/core/wallet/utils/expiration";
import {
  createExpirationNoticeCounts,
  type ExpirationNoticeCounts,
  type ExpirationNoticeRunState,
} from "./expirationNoticeSender";
import { sendExpiredNotices, type SendExpiredNoticesResult } from "./sendExpiredNotices";
import { sendPreExpiryNotices, type SendPreExpiryNoticesResult } from "./sendPreExpiryNotices";

/** Vercel の maxDuration 300s を前提に、起動・後片付けの余裕を残した既定の時間予算 */
const DEFAULT_BUDGET_MS = 240_000;

export type SendWalletExpirationNoticesOptions = {
  budgetMs?: number;
};

export type SendWalletExpirationNoticesResult = {
  /** 通知の設定が1つも無く、何もせず終了した */
  skipped: boolean;
  preExpiry: SendPreExpiryNoticesResult;
  expired: SendExpiredNoticesResult;
  /** 連続失敗で打ち切った（メール基盤の障害など。設定と message_dispatches を確認する） */
  aborted: boolean;
};

function emptyResult(): ExpirationNoticeCounts & { exhausted: boolean; aborted: boolean } {
  return { ...createExpirationNoticeCounts(), exhausted: true, aborted: false };
}

function mergeExpired(
  a: SendExpiredNoticesResult,
  b: SendExpiredNoticesResult,
): SendExpiredNoticesResult {
  const merged = { ...a };
  for (const key of Object.keys(createExpirationNoticeCounts()) as (keyof ExpirationNoticeCounts)[]) {
    merged[key] = a[key] + b[key];
  }
  return { ...merged, exhausted: b.exhausted, aborted: b.aborted };
}

/**
 * 失効予告と失効時の本通知を送る。冪等・再実行安全（同じ対象には1回しか届かない）。
 * 推奨スケジュール: 毎時。送信量が多いプロジェクトは頻度を上げる（実行が重なっても二重には届かない）。
 */
export async function sendWalletExpirationNotices(
  options: SendWalletExpirationNoticesOptions = {},
): Promise<SendWalletExpirationNoticesResult> {
  const walletTypes = Object.keys(WALLET_EXPIRATION_CONFIG) as WalletType[];
  const hasNotice = walletTypes.some(
    (type) => getExpiredNotice(type) !== null || getPreExpiryNoticeStages(type).length > 0,
  );
  if (!hasNotice) {
    return { skipped: true, preExpiry: emptyResult(), expired: emptyResult(), aborted: false };
  }

  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;

  return runAsSystem(async () => {
    const startedAt = new Date();
    const fullDeadline = createDeadline(budgetMs, startedAt);
    const state: ExpirationNoticeRunState = { consecutiveFailures: 0 };

    let expired = await sendExpiredNotices({
      deadline: createDeadline(budgetMs / 2, startedAt),
      state,
    });
    if (expired.aborted) {
      return { skipped: false, preExpiry: emptyResult(), expired, aborted: true };
    }

    const preExpiry = await sendPreExpiryNotices({ deadline: fullDeadline, state });
    if (preExpiry.aborted) {
      return { skipped: false, preExpiry, expired, aborted: true };
    }

    // 本通知が前半の予算で終わらず、予告の後に時間が残っていれば続きを処理する
    if (!expired.exhausted && Date.now() < fullDeadline.getTime()) {
      expired = mergeExpired(expired, await sendExpiredNotices({ deadline: fullDeadline, state }));
    }

    return { skipped: false, preExpiry, expired, aborted: expired.aborted };
  });
}
