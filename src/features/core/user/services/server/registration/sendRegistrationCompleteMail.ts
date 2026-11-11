// src/features/core/user/services/server/registration/sendRegistrationCompleteMail.ts

import { business } from "@/business";
import { userConfig } from "@/features/user/config";
import { messagingService } from "@/features/core/messaging/services/server";
import { message as earlyRegistrationCompleteMessage } from "@/features/core/user/messages/earlyRegistrationComplete";
import { message as registrationCompleteMessage } from "@/features/core/user/messages/registrationComplete";
import { DomainError } from "@/lib/errors";

export type SendRegistrationCompleteMailParams = {
  email: string;
  displayName: string;
};

/**
 * 登録完了メールを送信します。
 * サインアップモードに応じて連絡(user.earlyRegistrationComplete / user.registrationComplete)を選び、
 * 送る口(messagingService.sendMessage)でメールアドレスへ送ります。送れなければ DomainError(500)。
 * 一時の失敗で queued に残った配達は cron が送り直すので、失敗にしない。
 */
export async function sendRegistrationCompleteMail({
  email,
  displayName,
}: SendRegistrationCompleteMailParams): Promise<void> {
  const mode = userConfig.signupMode;

  try {
    const result =
      mode === "earlyRegistration"
        ? await messagingService.sendMessage(earlyRegistrationCompleteMessage, {
            recipient: { channel: "email", address: email },
            vars: { displayName, serviceNameShort: business.serviceNameShort },
          })
        : await messagingService.sendMessage(registrationCompleteMessage, {
            recipient: { channel: "email", address: email },
            vars: { displayName, serviceNameShort: business.serviceNameShort, siteUrl: business.url },
          });
    const delivery = result.deliveries.find((item) => item.channel === "email");
    if (delivery?.status !== "sent" && delivery?.status !== "queued") {
      throw new Error(delivery ? [delivery.status, delivery.reason].filter(Boolean).join(": ") : `dispatch ${result.status}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DomainError(
      `登録完了メールの送信に失敗しました: ${reason}`,
      { status: 500 },
    );
  }
}
