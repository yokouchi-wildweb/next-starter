// src/features/core/messaging/sources/adminBulk.ts
//
// 送り元 messaging.adminBulk の表示名(回の詳細の「送り元」。運営する人に鍵を見せない、D46)。管理一覧の一括送信(対象の鍵の無い userIds 指定。対象つきは <対象>.bulk = 対象の名前の一括送信)

import type { MessageSource } from "@/lib/messaging";

export const source: MessageSource = { key: "messaging.adminBulk", label: "一括送信" };
