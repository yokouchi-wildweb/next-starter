// src/config/app/wallet-notification.config.ts
// 管理者による残高変更通知の文言(組み立て: wallet/services/server/notification/adjustmentNotificationTemplate.default.ts)

export const WALLET_ADJUSTMENT_NOTIFICATION = {
  /** タイトルの「<通貨名>」の後ろ */
  titleSuffix: "残高が変更されました",
  /** 操作方法の表示ラベル */
  changeMethodLabels: {
    INCREMENT: "増加",
    DECREMENT: "減少",
    SET: "残高設定",
  } as Readonly<Record<string, string>>,
  /** 本文の各行の見出し */
  bodyLabels: {
    method: "操作",
    amount: "金額",
    balance: "残高",
    reason: "理由",
  },
};
