// src/features/core/userProfile/generated/contributor/model.ts
// 投稿者プロフィールのモデル型定義
//
// 元情報: src/features/core/userProfile/profiles/contributor.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

/**
 * 投稿者プロフィールモデル
 */
export type ContributorProfileModel = {
  /** 主キー */
  id: string;
  /** ユーザーID */
  userId: string;
  isApproved: boolean | null;
  approvedAt: Date | null;
  approvalNote: string | null;
  /** 作成日時 */
  createdAt: Date | null;
  /** 更新日時 */
  updatedAt: Date | null;
};
