// src/features/messaging/services/server/channels/email.tsx
//
// メールチャネルの薄いラッパー。AdminAnnouncementEmail テンプレートを使い
// lib/mail.send() で配信する。投げられる例外は MessagingChannelResult として
// 構造化された結果に変換し、呼び出し側が send/bulkSend ともに同じ形で扱えるようにする。

import { send } from "@/lib/mail";

import { AdminAnnouncementEmail } from "@/features/core/mail/templates/AdminAnnouncementEmail";

import type { MessagingChannelResult } from "../../../entities/model";

export type SendEmailParams = {
  to: string;
  displayName: string;
  subject: string;
  body: string;
};

/**
 * 1 ユーザーへメールを送信し、結果を構造化された MessagingChannelResult として返す。
 * 例外は内部で catch し、attempted=true / succeeded=false / error にメッセージを格納する。
 */
export async function sendEmailViaTemplate(
  params: SendEmailParams,
): Promise<MessagingChannelResult> {
  try {
    const element = (
      <AdminAnnouncementEmail.component
        displayName={params.displayName}
        subject={params.subject}
        body={params.body}
      />
    );
    await send({
      to: params.to,
      subject: params.subject,
      react: element,
    });
    return { attempted: true, succeeded: true, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { attempted: true, succeeded: false, error: message };
  }
}
