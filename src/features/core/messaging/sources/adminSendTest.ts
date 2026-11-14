// src/features/core/messaging/sources/adminSendTest.ts
//
// 送り元 messaging.adminSend.test の表示名(回の詳細の「送り元」。運営する人に鍵を見せない、D46)。送るモーダルの自分へのテスト送信

import type { MessageSource } from "@/lib/messaging";

export const source: MessageSource = { key: "messaging.adminSend.test", label: "テスト送信" };
