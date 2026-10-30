// src/config/ui/rate-limit-warning.config.ts

/** 重複登録の警告モーダルの文言(本文は行ごと) */
export const RATE_LIMIT_WARNING = {
  title: "重複したユーザー登録が確認されました。",
  bodyLines: ["同一人物による複数アカウントの作成は", "重大な利用規約違反となります。"],
} as const;
