// src/features/core/messaging/sources/adminSend.ts
//
// 送り元 messaging.adminSend の表示名(回の詳細の「送り元」。運営する人に鍵を見せない、D46)。管理画面の送るモーダル(POST /api/admin/messaging/send)

import type { MessageSource } from "@/lib/messaging";

export const source: MessageSource = { key: "messaging.adminSend", label: "管理画面から送信" };
