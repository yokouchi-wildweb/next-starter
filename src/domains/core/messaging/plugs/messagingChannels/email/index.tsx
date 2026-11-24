// src/domains/core/messaging/plugs/messagingChannels/email/index.tsx
//
// 上流の送信チャンネル email(送信チャンネルの受け口の項目)。宛先は users.email、送信は lib/mail、描き方はレイアウト(点 messagingLayouts の messagingLayoutEmails、閉じたドメインの物は外す > 汎用 > 要約)。
// 中身: ./createEmailChannel.tsx

import { render } from "@react-email/render";
import { and, inArray, isNotNull, isNull } from "drizzle-orm";

import { gate } from "@/featureGate";
import { db } from "@/lib/drizzle";
import { MAIL_THEME_COLORS, send } from "@/lib/mail";
import { getAppBaseUrl } from "@/lib/url";

import { UserTable } from "@/domains/core/user/entities/drizzle";

import { MESSAGE_PREFERENCES_PAGE_PATH } from "@/domains/core/messaging/constants/preferences";
import { layoutEmails, layouts } from "@/domains/core/messaging/services/server/layoutLists";
import { createEmailChannel } from "./createEmailChannel";

export const channel = createEmailChannel({
  render: (element) => render(element),
  send,
  theme: MAIL_THEME_COLORS,
  layouts,
  layoutEmails,
  // 門 messagingPreferences が開なら本文の停止のリンクを好みのページへ(閉 = ワンクリックの URL のまま)
  preferencesPageUrl: () =>
    gate.enabled("messagingPreferences") ? `${getAppBaseUrl()}${MESSAGE_PREFERENCES_PAGE_PATH}` : null,
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
  // 受信者の表示名(レイアウトの描き方の recipient)。消した利用者は入れない
  async findRecipients(userIds) {
    const rows = await db
      .select({ userId: UserTable.id, name: UserTable.name })
      .from(UserTable)
      .where(and(inArray(UserTable.id, [...userIds]), isNull(UserTable.deletedAt)));
    return new Map(rows.map((row) => [row.userId, { displayName: row.name?.trim() || null }]));
  },
});
