// src/features/core/wallet/services/server/notification/expirationNoticeSender.ts
// 失効通知（予告・本通知）共通の送信処理
//
// 1ページ分の送信ジョブを受け取り、送信済みの除外 → 送信対象の絞り込み → 送信 を行う。
// 文面は連絡の定義(messages/expiringNotice.ts・expiredNotice.ts)、送る口は messagingService.sendMessage。
// ジョブは定義に差し込む値(vars)を持ち、宛名(displayName)とサービスの短い名前はここで足す。
// 経路は連絡の種類が決める(D86)ので渡さない。メール未登録の人はメールの行が宛先なし(no_address)になり、ほかの経路で届く。

import { inArray } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { isDomainError } from "@/lib/errors";
import { business } from "@/business";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";
import type { MessagingSource } from "@/features/core/messaging/constants/sources";
import type { MessageDefinition } from "@/lib/messaging";
import { messageRegistry } from "@/registry/messageRegistry";
import { walletConfig } from "@/features/wallet/config";

/**
 * 連続でこの件数失敗したら、その実行を打ち切る。
 * 冪等性キーの行は送信「前」に作られるため、メール基盤の障害中に送り続けると
 * 再送できないまま通知が失われ続ける。打ち切ることで損失をこの件数までに抑える。
 */
const MAX_CONSECUTIVE_FAILURES = 10;

export type ExpirationNoticeJob = {
  userId: string;
  /** 二重送信防止キー（同じ通知対象には常に同じ値になること） */
  idempotencyKey: string;
  /** 送る連絡の定義(失効の予告か本通知、config の messageKey で fork の連絡にも向く) */
  message: MessageDefinition;
  /** 定義の vars のうち宛名・サービスの短い名前を除いた値(送る時に足す) */
  vars: Record<string, string>;
  source: MessagingSource;
};

/**
 * config の messageKey から送る連絡の定義を引く(省略・上流の鍵 = 上流の定義)。
 * @throws Error 生成の一覧に無い鍵(config の誤り。送らずに止める)
 */
export async function noticeMessageOf(messageKey: string | undefined, upstream: MessageDefinition): Promise<MessageDefinition> {
  if (!messageKey || messageKey === upstream.key) return upstream;
  const entry = (messageRegistry as Record<string, { definition: () => Promise<{ message?: MessageDefinition }> } | undefined>)[messageKey];
  const message = entry ? (await entry.definition()).message : undefined;
  if (!message) throw new Error(`walletConfig の失効通知の messageKey ${messageKey} は連絡の一覧(src/registry/messageRegistry.ts)に無い`);
  return message;
}

export type ExpirationNoticeCounts = {
  /** 送信できた件数（指定チャネルのうち1つ以上が成功） */
  sent: number;
  /** 既に送信済みだったため何もしなかった件数 */
  alreadySent: number;
  /** 対象外ステータスのためスキップした件数 */
  skippedStatus: number;
  /** demo ユーザーのためスキップした件数 */
  skippedDemo: number;
  /** ユーザーが存在しない、または削除済み（deleted_at あり）だった件数 */
  skippedUserMissing: number;
  /** 送信に失敗した件数（再実行しても再送されない。message_dispatches・message_deliveries で確認する） */
  failed: number;
};

export function createExpirationNoticeCounts(): ExpirationNoticeCounts {
  return {
    sent: 0,
    alreadySent: 0,
    skippedStatus: 0,
    skippedDemo: 0,
    skippedUserMissing: 0,
    failed: 0,
  };
}

/** 連続失敗の打ち切りを実行全体で共有するための状態 */
export type ExpirationNoticeRunState = {
  consecutiveFailures: number;
};

/**
 * ページの途中で送信を止めたことを呼び出し側へ伝える。
 * 呼び出し側はそのページを完了扱いにせず（チェックポイントを進めず）実行を終える。
 * - aborted: 連続失敗による打ち切り
 * - deadline: 締切到達（残りは次回実行が処理する。送信済みの相手は冪等性キーで除外される）
 */
export class ExpirationNoticeStopError extends Error {
  readonly reason: "aborted" | "deadline";

  constructor(reason: "aborted" | "deadline") {
    super(
      reason === "aborted"
        ? `失効通知の送信が連続 ${MAX_CONSECUTIVE_FAILURES} 件失敗したため打ち切りました。`
        : "失効通知の送信が締切に達したため中断しました。",
    );
    this.name = "ExpirationNoticeStopError";
    this.reason = reason;
  }
}

async function sendOne(job: ExpirationNoticeJob, displayName: string): Promise<"sent" | "alreadySent" | "failed"> {
  try {
    const result = await messagingService.sendMessage(job.message, {
      recipient: { userId: job.userId },
      vars: { ...job.vars, displayName, serviceNameShort: business.serviceNameShort },
      source: job.source,
      idempotencyKey: job.idempotencyKey,
    });
    // 1 つ以上の経路で送れた(sent)か、一時の失敗で送り直し待ち(queued、cron が送る)なら送った扱い
    return result.deliveries.some((delivery) => delivery.status === "sent" || delivery.status === "queued")
      ? "sent"
      : "failed";
  } catch (error) {
    // 並走した別の実行が先に送った場合
    if (isDomainError(error) && error.status === 409) return "alreadySent";
    console.error(
      `[wallet.expirationNotice] 送信失敗 userId=${job.userId} key=${job.idempotencyKey}: `,
      error,
    );
    return "failed";
  }
}

/**
 * 1ページ分の通知を送る。
 *
 * - 1件の失敗で後続を止めない（失敗は数えるだけ）。ただし連続失敗が続いたら実行を打ち切る
 * - 締切は送信の合間にも確認する（ランナーの締切判定はページの間だけなので、
 *   1ページの送信が長引いても maxDuration を超えないようにする）
 * - ユーザー情報の取得はページの userId に限定した1クエリ（全件取得しない）
 *
 * @throws ExpirationNoticeStopError 連続失敗が上限に達した / 締切に達した場合
 */
export async function sendExpirationNoticeJobs(
  jobs: ExpirationNoticeJob[],
  counts: ExpirationNoticeCounts,
  state: ExpirationNoticeRunState,
  deadline: Date,
): Promise<void> {
  if (jobs.length === 0) return;

  // 1. 送信済みを除外（再実行で同じ対象を読み直したときに send() を空振りさせない）
  const existingKeys = await messagingService.existingIdempotencyKeys(jobs.map((job) => job.idempotencyKey));
  const pending = jobs.filter((job) => !existingKeys.has(job.idempotencyKey));
  counts.alreadySent += jobs.length - pending.length;
  if (pending.length === 0) return;

  // 2. 送信対象の絞り込み（削除済み・ステータス・demo・送れるチャネル）
  const users = await db
    .select({
      id: UserTable.id,
      status: UserTable.status,
      name: UserTable.name,
      email: UserTable.email,
      isDemo: UserTable.isDemo,
      deletedAt: UserTable.deletedAt,
    })
    .from(UserTable)
    .where(inArray(UserTable.id, [...new Set(pending.map((job) => job.userId))]));
  const userById = new Map(users.map((user) => [user.id, user]));
  const targetStatuses = walletConfig.expirationNoticeSettings.targetStatuses;

  const sendable: { job: ExpirationNoticeJob; displayName: string }[] = [];
  for (const job of pending) {
    const user = userById.get(job.userId);
    // 汎用の remove は deleted_at を入れるだけで status を変えないため、ステータスとは別に見る
    if (!user || user.deletedAt) {
      counts.skippedUserMissing += 1;
      continue;
    }
    if (user.isDemo) {
      counts.skippedDemo += 1;
      continue;
    }
    if (!targetStatuses.includes(user.status)) {
      counts.skippedStatus += 1;
      continue;
    }
    // 宛名は前のお知らせのメールと同じ(名前が無ければ「お客様」)。メール未登録ならメールの行は no_address(送る口が決める)
    sendable.push({ job, displayName: user.name ?? "お客様" });
  }

  // 3. 送信（sendConcurrency 件ずつ）
  const concurrency = Math.max(1, Math.floor(walletConfig.expirationNoticeSettings.sendConcurrency));
  for (let i = 0; i < sendable.length; i += concurrency) {
    if (Date.now() >= deadline.getTime()) throw new ExpirationNoticeStopError("deadline");
    const slice = sendable.slice(i, i + concurrency);
    const outcomes = await Promise.all(slice.map(({ job, displayName }) => sendOne(job, displayName)));
    for (const outcome of outcomes) {
      if (outcome === "failed") {
        counts.failed += 1;
        state.consecutiveFailures += 1;
      } else {
        if (outcome === "sent") counts.sent += 1;
        else counts.alreadySent += 1;
        state.consecutiveFailures = 0;
      }
    }
    if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      throw new ExpirationNoticeStopError("aborted");
    }
  }
}
