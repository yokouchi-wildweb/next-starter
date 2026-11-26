// src/domains/core/coupon/types/couponField.ts

// このファイルは domain-config スクリプトによって自動生成されています。
// 手動での編集は変更が上書きされる可能性があるため推奨されません。

type FieldConstants = typeof import("../constants/couponField");

export type CouponTypeOption = FieldConstants["CouponTypeOptions"][number];
export type CouponTypeValue = CouponTypeOption["value"];
export type CouponTypeLabel = CouponTypeOption["label"];

export type CouponStatusOption = FieldConstants["CouponStatusOptions"][number];
export type CouponStatusValue = CouponStatusOption["value"];
export type CouponStatusLabel = CouponStatusOption["label"];
