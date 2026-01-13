// src/features/core/userProfile/generated/admin/model.ts
// 管理者プロフィールのモデル型定義
//
// 元情報: src/features/core/userProfile/profiles/admin.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

/**
 * 管理者プロフィールモデル
 */
export type AdminProfileModel = {
  /** 主キー */
  id: string;
  /** ユーザーID */
  userId: string;
  bar: "apple" | "orange";
  foo: string;
  /** 作成日時 */
  createdAt: Date | null;
  /** 更新日時 */
  updatedAt: Date | null;
};
