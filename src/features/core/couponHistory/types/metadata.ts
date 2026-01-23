// クーポン使用履歴のメタデータ型定義

/**
 * システムが自動設定するスナップショット情報
 */
export type CouponSnapshot = {
  code: string;
  type: string;
  name: string;
  attribution_user_id: string | null;
  current_total_uses_after: number;
};

/**
 * クーポン使用履歴の metadata フィールドの型
 * - スナップショット情報 + 使用側からの追加情報
 */
export type CouponUsageMetadata = CouponSnapshot & {
  [key: string]: unknown;
};
