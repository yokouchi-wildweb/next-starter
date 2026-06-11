// src/features/core/bankTransferReview/services/server/wrappers/bulkSendEmail.tsx
//
// 振込レビュー一覧のバルクアクション「メール一斉送信」サーバーロジック。
// 発送リクエストの bulkSendEmail と同等の挙動（共通 UI コンポーネント
// BulkSendEmailButton から呼ばれる）。
//
// 実体の送信処理（メール / 通知 / 監査ログ / dispatch 永続化）は
// @/features/messaging の messagingService.bulkSend() に委譲する。
// 本ファイルは「対象レビューから user_id を抽出 → messagingService 呼び出し
// → admin_memo 追記」という振込レビュー固有の処理に集中する。
//
// 結果型は共通契約 @/components/BulkSendEmail/types の BulkSendEmailResult と
// 構造一致させる（サーバー／クライアントの型は本リポジトリの慣習どおり別定義）。

import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";
import { formatDateJa } from "@/utils/date";

import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import { messagingService } from "@/features/messaging/services/server";
import { MESSAGING_SOURCES } from "@/features/messaging/constants/sources";
import type { MessagingChannel } from "@/features/messaging/constants/channels";

/** 一斉メール送信 + お知らせ通知の入力 */
export type BulkSendEmailParams = {
  /** 対象の振込レビュー ID 配列（管理画面で選択された全件） */
  reviewIds: string[];
  /** メール件名（必須・自由入力） */
  emailSubject: string;
  /** メール本文（必須・プレーンテキスト・自由入力） */
  emailBody: string;
  /** お知らせ通知も発行するか */
  sendNotification: boolean;
  /** 通知タイトル（sendNotification=true のとき必須） */
  notificationTitle?: string;
  /** 通知本文（sendNotification=true のとき必須） */
  notificationBody?: string;
};

/** メール送信失敗時の詳細 */
export type BulkSendEmailFailure = {
  userId: string;
  email: string | null;
  reason: string;
};

/** 一斉メール送信の結果 */
export type BulkSendEmailResult = {
  /** 重複排除後の送信対象ユーザー数 */
  targetUserCount: number;
  /** メール送信成功件数 */
  emailSentCount: number;
  /** メール送信失敗件数 */
  emailFailedCount: number;
  /** メール送信失敗の詳細 */
  emailFailures: BulkSendEmailFailure[];
  /** お知らせ通知が発行されたか（sendNotification=false のときは null） */
  notificationCreated: boolean | null;
  /** admin_memo を追記した振込レビュー件数 */
  memoAppendedCount: number;
};

/**
 * 振込レビュー一覧で選択された全件のユーザーに対し一斉送信する。
 *
 * - メールは 1 ユーザー 1 通（重複ユーザーは 1 通に集約）
 * - メール送信失敗は他の送信を止めず、件数のみ集計
 * - 通知は 1 レコード（target_type=individual）で全対象ユーザーに送付
 * - 送信成功・失敗ごとに audit_logs を 1 行ずつ記録（messagingService が担当）
 * - メール送信後、選択された全レビューの admin_memo に
 *   `YYYY/MM/DD「件名」メール送付` の 1 行を追記する
 */
export async function bulkSendEmail(
  params: BulkSendEmailParams,
): Promise<BulkSendEmailResult> {
  const {
    reviewIds,
    emailSubject,
    emailBody,
    sendNotification,
    notificationTitle,
    notificationBody,
  } = params;

  if (reviewIds.length === 0) {
    throw new DomainError("振込レビューが選択されていません。", {
      status: 400,
    });
  }
  if (!emailSubject.trim() || !emailBody.trim()) {
    throw new DomainError("メール件名・本文は必須です。", { status: 400 });
  }
  if (sendNotification) {
    if (!notificationTitle?.trim() || !notificationBody?.trim()) {
      throw new DomainError("通知タイトル・本文は必須です。", { status: 400 });
    }
  }

  // 対象レビューを取得（user_id を引いて重複排除）
  const reviews = await db
    .select({
      id: BankTransferReviewTable.id,
      user_id: BankTransferReviewTable.user_id,
    })
    .from(BankTransferReviewTable)
    .where(inArray(BankTransferReviewTable.id, reviewIds));

  if (reviews.length === 0) {
    throw new DomainError("対象の振込レビューが見つかりませんでした。", {
      status: 404,
    });
  }

  const uniqueUserIds = [...new Set(reviews.map((r) => r.user_id))];

  // messaging ドメインへ委譲
  const channels: MessagingChannel[] = ["email"];
  if (sendNotification) channels.push("inApp");

  const result = await messagingService.bulkSend({
    recipients: uniqueUserIds.map((id) => ({ id })),
    channels,
    emailSubject: emailSubject.trim(),
    emailBody: emailBody.trim(),
    notificationTitle: notificationTitle?.trim(),
    notificationBody: notificationBody?.trim(),
    source: MESSAGING_SOURCES.BANK_TRANSFER_REVIEW_BULK,
  });

  // メール失敗を既存 API 互換の形に整形
  const emailFailures: BulkSendEmailFailure[] = result.perRecipient
    .filter((r) => r.email.attempted && !r.email.succeeded)
    .map((r) => ({
      userId: r.userId,
      email: r.recipientEmail,
      reason: r.email.error ?? "不明なエラー",
    }));

  // admin_memo 追記（メールについてのみ記載・通知については記載しない）
  const memoAppendedCount = await appendAdminMemo({
    reviewIds: reviews.map((r) => r.id),
    emailSubject: emailSubject.trim(),
  });

  return {
    targetUserCount: result.recipientCount,
    emailSentCount: result.emailSuccessCount,
    emailFailedCount: result.emailFailedCount,
    emailFailures,
    notificationCreated: result.notificationCreated,
    memoAppendedCount,
  };
}

/**
 * 選択された全レビューの admin_memo に
 * `YYYY/MM/DD「件名」メール送付` の 1 行を追記する。
 *
 * 既存メモがある場合は改行で連結。件名に任意文字が含まれ得るため、
 * SQL 連結ではなくアプリ側で安全に文字列を組み立てる。
 */
async function appendAdminMemo(input: {
  reviewIds: string[];
  emailSubject: string;
}): Promise<number> {
  const { reviewIds, emailSubject } = input;
  const today = formatDateJa(new Date(), { format: "YYYY/MM/DD" }) ?? "";
  const memoLine = `${today}「${emailSubject}」メール送付`;

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: BankTransferReviewTable.id,
        admin_memo: BankTransferReviewTable.admin_memo,
      })
      .from(BankTransferReviewTable)
      .where(inArray(BankTransferReviewTable.id, reviewIds))
      .for("update");

    const now = new Date();
    let count = 0;
    for (const row of rows) {
      const next = row.admin_memo
        ? `${row.admin_memo}\n${memoLine}`
        : memoLine;
      await tx
        .update(BankTransferReviewTable)
        .set({ admin_memo: next, updatedAt: now })
        .where(eq(BankTransferReviewTable.id, row.id));
      count++;
    }
    return count;
  });
}
