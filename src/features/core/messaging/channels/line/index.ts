// src/features/core/messaging/channels/line/index.ts
//
// 上流の経路 line(LINE push)。既定は切(messaging の config channels.line.enabled、fork は src/config の上書きで開ける)。
// 宛先は LINE の連携の機能 userLineProfile の表から引く(機能が閉じていれば宛先なし)。中身: ./createLineChannel.ts

import { inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { gate } from "@/featureGate";
import { pushMessage, textMessage } from "@/lib/line";

import { UserLineProfileTable } from "@/features/core/userLineProfile/entities/drizzle";

import { messagingConfig } from "../../config";
import { createLineChannel } from "./createLineChannel";

export const channel = createLineChannel({
  enabled: messagingConfig.channels.line.enabled,
  async findLineUserIds(userIds) {
    if (userIds.length === 0 || !gate.enabled("userLineProfile")) return [];
    const rows = await db
      .select({ userId: UserLineProfileTable.userId, address: UserLineProfileTable.lineUserId })
      .from(UserLineProfileTable)
      .where(inArray(UserLineProfileTable.userId, [...userIds]));
    return rows;
  },
  push: (to, text) => pushMessage(to, [textMessage(text)]),
});
