// src/config/app/user-update.config.ts

/** 利用者の更新の検証に失敗したときの文(スキーマが自前の文を書いていない項目に使う) */
export const USER_UPDATE_VALIDATION = {
  fallbackMessage: "入力内容を確認してください。",
} as const;
