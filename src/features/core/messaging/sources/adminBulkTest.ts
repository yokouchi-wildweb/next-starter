// src/features/core/messaging/sources/adminBulkTest.ts
//
// 送り元 messaging.adminBulk.test の表示名(回の詳細の「送り元」。運営する人に鍵を見せない、D46)。一括送信の自分へのテスト送信

import type { MessageSource } from "@/lib/messaging";

export const source: MessageSource = { key: "messaging.adminBulk.test", label: "一括送信のテスト" };
