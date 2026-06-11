// src/features/messaging/services/server/send.ts
//
// 単発送信。1 ユーザーに対してメール + サービス内通知の任意の組み合わせを送る。
// 既存の user/sendMessage.tsx と同等の挙動を提供しつつ、
// 内部で message_dispatches + audit_logs の永続化を行う。

import { eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";

import { UserTable } from "@/features/core/user/entities/drizzle";

import { MESSAGING_CHANNELS } from "../../constants/channels";
import type {
  MessagingChannelResult,
  MessagingRecipientResult,
  MessagingSendInput,
  MessagingSendResult,
} from "../../entities/model";
import { recordRecipientAudits } from "./auditing";
import { sendEmailViaTemplate } from "./channels/email";
import { sendInAppNotification } from "./channels/inApp";
import { insertDispatch } from "./dispatch";

const EMPTY_CHANNEL_RESULT: MessagingChannelResult = {
  attempted: false,
  succeeded: false,
  error: null,
};

/**
 * 単一ユーザーへメッセージを送信する。
 *
 * - channels に含めたチャネルのみ送信を試みる
 * - メール送信は失敗してもユーザー通知は継続する（独立した経路）
 * - メールアドレス未登録ユーザーで email チャネル指定 → DomainError（呼び出し元の契約違反）
 * - 送信完了後、message_dispatches に 1 行、audit_logs に 1 行記録する
 */
export async function send(
  input: MessagingSendInput,
): Promise<MessagingSendResult> {
  validateChannelContent(input);

  const useEmail = input.channels.includes(MESSAGING_CHANNELS.EMAIL);
  const useInApp = input.channels.includes(MESSAGING_CHANNELS.IN_APP);

  const [user] = await db
    .select({
      id: UserTable.id,
      email: UserTable.email,
      name: UserTable.name,
    })
    .from(UserTable)
    .where(eq(UserTable.id, input.recipient.id))
    .limit(1);

  if (!user) {
    throw new DomainError("ユーザーが見つかりません。", { status: 404 });
  }

  if (useEmail && !user.email) {
    throw new DomainError(
      "メールアドレスが未登録のユーザーにはメールを送信できません。",
      { status: 400 },
    );
  }

  // チャネル別の送信
  let emailResult: MessagingChannelResult = EMPTY_CHANNEL_RESULT;
  if (useEmail) {
    emailResult = await sendEmailViaTemplate({
      to: user.email!,
      displayName: user.name ?? "お客様",
      subject: input.emailSubject!,
      body: input.emailBody!,
    });
    if (!emailResult.succeeded) {
      console.error(
        `[messaging.send] メール送信失敗 userId=${user.id} email=${user.email}: ${emailResult.error}`,
      );
    }
  }

  let inAppResult: MessagingChannelResult = EMPTY_CHANNEL_RESULT;
  let notificationCreated: boolean | null = null;
  if (useInApp) {
    const result = await sendInAppNotification({
      title: input.notificationTitle!,
      body: input.notificationBody!,
      targetUserIds: [user.id],
      metadata: { dispatchSource: input.source },
    });
    notificationCreated = result.created;
    inAppResult = {
      attempted: true,
      succeeded: result.created,
      error: result.error,
    };
  }

  // ジョブ単位の永続化
  const dispatchId = await insertDispatch({
    channels: input.channels,
    emailSubject: useEmail ? input.emailSubject! : null,
    emailBody: useEmail ? input.emailBody! : null,
    notificationTitle: useInApp ? input.notificationTitle! : null,
    notificationBody: useInApp ? input.notificationBody! : null,
    recipientCount: 1,
    emailSuccessCount: emailResult.succeeded ? 1 : 0,
    emailFailedCount: emailResult.attempted && !emailResult.succeeded ? 1 : 0,
    notificationCreated,
    source: input.source,
    reason: input.reason ?? null,
  });

  // 受信者単位の監査ログ
  const recipient: MessagingRecipientResult = {
    userId: user.id,
    recipientEmail: user.email,
    email: emailResult,
    inApp: inAppResult,
  };
  await recordRecipientAudits({
    dispatchId,
    source: input.source,
    recipients: [recipient],
  });

  return { dispatchId, recipient };
}

/**
 * Zod の superRefine と同じ検証をサービス層でも実施（API 経路以外からの呼び出しへの保険）。
 */
function validateChannelContent(input: MessagingSendInput): void {
  if (input.channels.length === 0) {
    throw new DomainError(
      "channels を 1 件以上指定してください。",
      { status: 400 },
    );
  }
  if (input.channels.includes(MESSAGING_CHANNELS.EMAIL)) {
    if (!input.emailSubject?.trim() || !input.emailBody?.trim()) {
      throw new DomainError(
        "メール件名・本文は必須です。",
        { status: 400 },
      );
    }
  }
  if (input.channels.includes(MESSAGING_CHANNELS.IN_APP)) {
    if (!input.notificationTitle?.trim() || !input.notificationBody?.trim()) {
      throw new DomainError(
        "通知タイトル・本文は必須です。",
        { status: 400 },
      );
    }
  }
}
