// src/domains/core/messaging/plugs/messagingSources/legacyNotification.ts
//
// 送り元 legacy.notification の表示名(送信の詳細の「送り元」。運営する人に鍵を見せない、D46)。前のお知らせの機能から写した送信(S2 の写し)

import type { MessageSource } from "@/lib/messaging";

export const source: MessageSource = { key: "legacy.notification", label: "以前のお知らせ機能" };
