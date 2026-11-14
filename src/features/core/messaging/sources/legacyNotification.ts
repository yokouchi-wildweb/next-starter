// src/features/core/messaging/sources/legacyNotification.ts
//
// 送り元 legacy.notification の表示名(回の詳細の「送り元」。運営する人に鍵を見せない、D46)。前のお知らせの機能から写した回(S2 の写し)

import type { MessageSource } from "@/lib/messaging";

export const source: MessageSource = { key: "legacy.notification", label: "前のお知らせ" };
