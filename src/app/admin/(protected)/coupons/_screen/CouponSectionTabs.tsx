// src/app/admin/(protected)/coupons/_screen/CouponSectionTabs.tsx
//
// クーポン管理画面のセクションタブ（official / affiliate / invite + downstream 登録分）。
// タブの中身は buildCouponAdminSectionTabs()（registry 込み）が唯一の定義源。
// 配置（本文 or ヘッダー中央）はページの関心事なので、一覧コンポーネントではなく
// Screen がこのコンポーネントを置いて決める（ヘッダー中央 = AdminPage の center。bank-transfer-reviews の StatusTabs と同じ型）。
// coupons/* の Screen の部品。上流の 3 ルート(official / affiliate / invite)と、下流の追加セクションの Screen が読む
// (下流は `@/app/...` ではなく相対パス `../_screen/CouponSectionTabs` で import する)。

"use client";

import { SolidTabs } from "@/components/Navigation";
import { buildCouponAdminSectionTabs } from "@/features/core/coupon/lib/adminSectionTabs";

const ARIA_LABEL = "クーポン種別";

type Props = {
  /**
   * 見た目:
   * - "body": ページ本文の大きさ（デフォルト）
   * - "header": ヘッダーの行の中央に置く小さめの形（`<AdminPage center={<CouponSectionTabs variant="header" />}>`）
   */
  variant?: "body" | "header";
};

export function CouponSectionTabs({ variant = "body" }: Props) {
  const tabs = buildCouponAdminSectionTabs();
  return variant === "header" ? (
    <SolidTabs tabs={tabs} ariaLabel={ARIA_LABEL} size="sm" listClassName="mx-auto max-w-2xl" />
  ) : (
    <SolidTabs tabs={tabs} ariaLabel={ARIA_LABEL} />
  );
}
