// src/config/features/notification.config.ts
// お知らせ(通知)の設定の上書き(持ち主 src/features/core/notification/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: 未読通知モーダルを出す `export default { showUnreadModal: true, unreadModalPaths: ["/", "/mypage*"] } satisfies NotificationOverride;`
import type { NotificationOverride } from "@/features/notification/config";

export default {} satisfies NotificationOverride;
