// src/features/messaging/services/server/channels/inApp.ts
//
// サービス内お知らせ通知チャネル。notification ドメインの sendDirect を呼び、
// 1 通知レコードで複数ユーザー（target_type=individual）に配信する。
//
// バルク送信ではこの 1 レコードが全対象ユーザー宛に表示される設計のため、
// 「ユーザー A は通知届いたが B は届かなかった」のような部分失敗は発生しない。
// 失敗は常にジョブ全体の失敗（レコード作成失敗）となる。
//
// sender_type は実行コンテキスト（ALS）から決める: cron 等のシステム起点（runAsSystem）なら
// "system"、それ以外（管理画面からの送信、コンテキスト無し）は "admin"。
// message_dispatches.actor_type と同じ情報源なので、送信記録と通知レコードの送信者種別が一致する。

import { getAuditContext } from "@/lib/audit";
import { sendDirect } from "@/features/core/notification/services/server/notification/sendDirect";

export type SendInAppNotificationParams = {
  title: string;
  body: string;
  targetUserIds: string[];
  metadata?: Record<string, unknown> | null;
};

export type SendInAppNotificationResult = {
  created: boolean;
  error: string | null;
};

/**
 * 個別指定の通知レコードを作成する。
 * 失敗は console.error して構造化エラーで返す（throw しない）。
 */
export async function sendInAppNotification(
  params: SendInAppNotificationParams,
): Promise<SendInAppNotificationResult> {
  const senderType = getAuditContext()?.actorType === "system" ? "system" : "admin";

  try {
    await sendDirect({
      title: params.title,
      body: params.body,
      targetType: "individual",
      targetUserIds: params.targetUserIds,
      senderType,
      metadata: params.metadata ?? null,
    });
    return { created: true, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    console.error("[messaging.inApp] 通知レコード作成失敗:", error);
    return { created: false, error: message };
  }
}
