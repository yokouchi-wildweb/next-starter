// src/features/core/auth/services/server/sendMailMessage.ts
//
// 認証のメール(messages/ の連絡)を 1 つのメールアドレスへ送り、送れなかったら投げる。
// 呼び手は今までどおり投げた理由を DomainError(500) の文に入れる。
// 送れた = メールの配達の行が sent。それ以外(failed・unknown・suppressed・行が無い)は送れなかった扱い

import { messagingService } from "@/features/core/messaging/services/server";

export async function sendMailMessage(
  message: Parameters<typeof messagingService.sendMessage>[0],
  address: string,
  vars: Record<string, unknown>,
): Promise<void> {
  const result = await messagingService.sendMessage(message, { recipient: { channel: "email", address }, vars });
  const delivery = result.deliveries.find((item) => item.channel === "email");
  if (delivery?.status === "sent") return;
  throw new Error(delivery ? [delivery.status, delivery.reason].filter(Boolean).join(": ") : `dispatch ${result.status}`);
}
