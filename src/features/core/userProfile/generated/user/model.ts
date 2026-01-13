// src/features/core/userProfile/generated/user/model.ts
// 一般プロフィールのモデル型定義
//
// 元情報: src/features/core/userProfile/profiles/user.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

/**
 * 一般プロフィールモデル
 */
export type UserProfileModel = {
  /** 主キー */
  id: string;
  /** ユーザーID */
  userId: string;
  foo: string | null;
  /** 作成日時 */
  createdAt: Date | null;
  /** 更新日時 */
  updatedAt: Date | null;
};
