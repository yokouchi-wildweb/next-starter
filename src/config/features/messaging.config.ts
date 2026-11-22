// src/config/features/messaging.config.ts
// 連絡(messaging)の処理の値の上書き(持ち主 src/features/core/messaging/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: 小さな送信の上限を上げる `export default { smallSendMaxRecipients: 300 } satisfies MessagingOverride;`
// 例: 送る画面・テンプレートの編集の最初のレイアウトを notice に `export default { initialLayout: "notice" } satisfies MessagingOverride;`(管理画面で選べる使えるレイアウトだけ)
import type { MessagingOverride } from "@/features/messaging/config";

export default {} satisfies MessagingOverride;
