// src/features/core/messaging/channels/email/index.tsx
//
// 上流の経路 email(経路の受け口の項目)。宛先は users.email、送信は lib/mail、連絡ごとの描き方は生成の一覧(messageRegistry)の view。
// 中身: ./createEmailChannel.tsx

import { render } from "@react-email/render";
import { and, inArray, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { MAIL_THEME_COLORS, send } from "@/lib/mail";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { messageRegistry } from "@/registry/messageRegistry";

import { createEmailChannel } from "./createEmailChannel";
import { loadRegistryView } from "./loadView";

export const channel = createEmailChannel({
  render: (element) => render(element),
  send,
  theme: MAIL_THEME_COLORS,
  loadView: (messageKey) => loadRegistryView(messageRegistry, messageKey),
  webhookKeys: {
    resendSecret: () => process.env.RESEND_WEBHOOK_SECRET?.trim() || null,
    sendgridPublicKey: () => process.env.SENDGRID_WEBHOOK_PUBLIC_KEY?.trim() || null,
  },
  async findEmails(userIds) {
    if (userIds.length === 0) return [];
    const rows = await db
      .select({ userId: UserTable.id, address: UserTable.email })
      .from(UserTable)
      .where(and(inArray(UserTable.id, [...userIds]), isNull(UserTable.deletedAt), isNotNull(UserTable.email)));
    return rows.flatMap((row) => (row.address ? [{ userId: row.userId, address: row.address }] : []));
  },
});
