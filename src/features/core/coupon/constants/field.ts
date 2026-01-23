// src/features/coupon/constants/field.ts

// このファイルは domain-config スクリプトによって自動生成されています。
// 手動での編集は変更が上書きされる可能性があるため推奨されません。

export const CouponTypeOptions = [
  { value: "official", label: "公式プロモーション" },
  { value: "affiliate", label: "アフィリエイト" },
  { value: "invite", label: "ユーザー招待" },
] as const;

export const CouponStatusOptions = [
  { value: "active", label: "有効" },
  { value: "inactive", label: "無効" }
] as const;
