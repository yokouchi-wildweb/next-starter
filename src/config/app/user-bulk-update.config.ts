// src/config/app/user-bulk-update.config.ts

/**
 * ユーザーの一括更新（userService.bulkUpdateByIds / bulkUpdate）の設定。
 * fields に足せるのは副作用の無い列だけ（UserCoreSchema の項目名）。ここに無い列は 400 で拒否する。
 * 表示名・ステータス・ロール・メール・電話番号・パスワード・isDemo は wrappers の処理が要るので足さない。
 */
export const USER_BULK_UPDATE = {
  fields: ["adminMemo", "user_tag_ids"],
  maxIds: 1000,
} as const;
