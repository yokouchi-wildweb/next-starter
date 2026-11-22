// src/config/domains/messaging.config.ts
// 連絡(messaging)の処理の値の上書き(持ち主 src/domains/core/messaging/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: 小さな送信の上限を上げる `export default { smallSendMaxRecipients: 300 } satisfies MessagingOverride;`
// 例: 送る画面・テンプレートの編集の最初のレイアウトを notice に `export default { initialLayout: "notice" } satisfies MessagingOverride;`(管理画面で選べる使えるレイアウトだけ)
// 例: 種別の表示名を変える(管理画面だけ別の名前なら adminLabel)`export default { kindLabels: { promotion: { label: "キャンペーン", adminLabel: "販促" } } } satisfies MessagingOverride;`
// 例: 配達の行を 1 年・重い中身(body・vars)を 30 日で消す `export default { retention: { deliveriesDays: 365, deliveryContentDays: 30 } } satisfies MessagingOverride;`
import type { MessagingOverride } from "@/domains/messaging/config";

export default {} satisfies MessagingOverride;
