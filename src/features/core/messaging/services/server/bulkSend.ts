// src/features/messaging/services/server/bulkSend.ts
//
// バルク送信。複数ユーザーに対してメール + サービス内通知を一括配信する。
//
// ## 設計のポイント
// - メール: ユーザー単位で送信し、失敗は記録して継続（途中で throw しない）
// - 通知: 1 レコードで複数ユーザーに配信（notification の target_type=individual）
//        通知失敗はジョブ全体の失敗扱いだが、メール送信は止めない
// - 並列度: chunkSize ごとに Promise.all で並列実行 → 完了後に次チャンク
// - 永続化: 送信「前」に message_dispatches 1 行を status='processing' で INSERT し、
//          全送信完了後に件数確定 UPDATE + audit_logs N 行（recordMany）。
//          事前 INSERT + idempotency_key の UNIQUE 制約により、同一キーの再実行は
//          メールを 1 通も送る前に拒否される（二重送信の構造的防止）

import { inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";

import { UserTable } from "@/features/core/user/entities/drizzle";

import { MESSAGING_CHANNELS } from "../../constants/channels";
import { DEFAULT_BULK_CHUNK_SIZE } from "../../constants/limits";
import type {
  MessagingBulkSendInput,
  MessagingBulkSendResult,
  MessagingChannelResult,
  MessagingRecipientResult,
} from "../../entities/model";
import { recordRecipientAudits } from "./auditing";
import { sendEmailViaTemplate } from "./channels/email";
import { sendInAppNotification } from "./channels/inApp";
import { completeDispatch, createDispatch } from "./dispatch";

const EMPTY_CHANNEL_RESULT: MessagingChannelResult = {
  attempted: false,
  succeeded: false,
  error: null,
};

/**
 * 複数ユーザーへメッセージを一括送信する。
 *
 * - recipients は内部で id 重複排除される
 * - 戻り値の perRecipient は重複排除後のユーザー単位
 */
export async function bulkSend(
  input: MessagingBulkSendInput,
): Promise<MessagingBulkSendResult> {
  validateChannelContent(input);

  const useEmail = input.channels.includes(MESSAGING_CHANNELS.EMAIL);
  const useInApp = input.channels.includes(MESSAGING_CHANNELS.IN_APP);

  const uniqueUserIds = [...new Set(input.recipients.map((r) => r.id))];

  // メール送信時のみユーザー情報が必要（email / name を引く）
  const userMap = useEmail ? await fetchUsersForEmail(uniqueUserIds) : null;

  // dispatch 永続化（送信前 INSERT, status='processing'）。
  // 同一 idempotencyKey の再実行はここで 409 になり、メールは 1 通も送られない。
  const dispatchId = await createDispatch({
    channels: input.channels,
    emailSubject: useEmail ? input.emailSubject! : null,
    emailBody: useEmail ? input.emailBody! : null,
    notificationTitle: useInApp ? input.notificationTitle! : null,
    notificationBody: useInApp ? input.notificationBody! : null,
    recipientCount: uniqueUserIds.length,
    source: input.source,
    reason: input.reason ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
  });

  // メール送信（chunkSize 単位で並列、チャンク間は逐次）
  const perRecipient = new Map<string, MessagingRecipientResult>();
  for (const userId of uniqueUserIds) {
    perRecipient.set(userId, {
      userId,
      recipientEmail: userMap?.get(userId)?.email ?? null,
      email: EMPTY_CHANNEL_RESULT,
      inApp: EMPTY_CHANNEL_RESULT,
    });
  }

  let emailSuccessCount = 0;
  let emailFailedCount = 0;

  if (useEmail && userMap) {
    const chunkSize = input.options?.chunkSize ?? DEFAULT_BULK_CHUNK_SIZE;
    for (let i = 0; i < uniqueUserIds.length; i += chunkSize) {
      const chunkIds = uniqueUserIds.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunkIds.map(async (userId) => {
          const result = await sendEmailForUser({
            userId,
            user: userMap.get(userId),
            emailSubject: input.emailSubject!,
            emailBody: input.emailBody!,
          });
          if (!result.succeeded) {
            console.error(
              `[messaging.bulkSend] メール送信失敗 userId=${userId}: ${result.error}`,
            );
          }
          return { userId, result };
        }),
      );
      for (const { userId, result } of results) {
        if (result.succeeded) emailSuccessCount += 1;
        else emailFailedCount += 1;
        const existing = perRecipient.get(userId);
        if (existing) existing.email = result;
      }
    }
  }

  // 通知発行（1 レコード）
  let notificationCreated: boolean | null = null;
  let inAppError: string | null = null;
  if (useInApp) {
    const result = await sendInAppNotification({
      title: input.notificationTitle!,
      body: input.notificationBody!,
      targetUserIds: uniqueUserIds,
      metadata: { dispatchSource: input.source },
    });
    notificationCreated = result.created;
    inAppError = result.error;

    // 全 perRecipient の inApp 結果を反映（通知は 1 レコードで一括配信）
    for (const r of perRecipient.values()) {
      r.inApp = {
        attempted: true,
        succeeded: result.created,
        error: result.error,
      };
    }
  }

  // 件数確定（status='completed' へ UPDATE）。
  // ここで失敗しても throw しない: メールは送信済みであり、500 を返すと呼び出し元に
  // 「失敗した」と誤認させて再実行 = 二重送信を誘発する。行は processing のまま残り、
  // 監査ログ（後続の recordRecipientAudits）と合わせて実態を追跡できる。
  try {
    await completeDispatch({
      dispatchId,
      emailSuccessCount,
      emailFailedCount,
      notificationCreated,
    });
  } catch (error) {
    console.error(
      `[messaging.bulkSend] dispatch 完了更新に失敗 dispatchId=${dispatchId} ` +
        `success=${emailSuccessCount} failed=${emailFailedCount}: `,
      error,
    );
  }

  // 受信者単位の監査ログ（recordMany で 1 statement INSERT）
  const recipientsList = [...perRecipient.values()];
  await recordRecipientAudits({
    dispatchId,
    source: input.source,
    recipients: recipientsList,
  });

  return {
    dispatchId,
    recipientCount: uniqueUserIds.length,
    emailSuccessCount,
    emailFailedCount,
    notificationCreated,
    perRecipient: recipientsList,
  };
}

type UserForEmail = { id: string; email: string | null; name: string | null };

async function fetchUsersForEmail(
  userIds: string[],
): Promise<Map<string, UserForEmail>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: UserTable.id,
      email: UserTable.email,
      name: UserTable.name,
    })
    .from(UserTable)
    .where(inArray(UserTable.id, userIds));
  return new Map(rows.map((u) => [u.id, u]));
}

async function sendEmailForUser(params: {
  userId: string;
  user: UserForEmail | undefined;
  emailSubject: string;
  emailBody: string;
}): Promise<MessagingChannelResult> {
  if (!params.user) {
    return {
      attempted: true,
      succeeded: false,
      error: "ユーザーが見つかりません",
    };
  }
  if (!params.user.email) {
    return {
      attempted: true,
      succeeded: false,
      error: "メールアドレスが未登録です",
    };
  }
  return sendEmailViaTemplate({
    to: params.user.email,
    displayName: params.user.name ?? "お客様",
    subject: params.emailSubject,
    body: params.emailBody,
  });
}

function validateChannelContent(input: MessagingBulkSendInput): void {
  if (input.recipients.length === 0) {
    throw new DomainError("受信者が指定されていません。", { status: 400 });
  }
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
