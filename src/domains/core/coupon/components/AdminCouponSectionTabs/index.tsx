// src/domains/core/coupon/components/AdminCouponSectionTabs/index.tsx
//
// 部品: クーポン管理画面のセクションタブ（official / affiliate / invite + downstream 登録分）。
// タブの中身は buildCouponAdminSectionTabs()（registry 込み）が唯一の定義源。
// 置き場所（本文 or ヘッダー中央）は Screen が決める（ヘッダー中央 = AdminPage の center。
// 通知の管理の AdminMessagingSectionTabs・bank-transfer-reviews の StatusTabs と同じ型）。
// 上流の 3 ルート(official / affiliate / invite)の Screen と、下流の追加セクションや差し替えの Screen が読む。

"use client";

import { SolidTabs } from "@/components/Navigation/PageTab";
import { buildCouponAdminSectionTabs } from "@/domains/core/coupon/lib/adminSectionTabs";

const ARIA_LABEL = "クーポン種別";

export type AdminCouponSectionTabsProps = {
  /**
   * 見た目:
   * - "body": ページ本文の大きさ（デフォルト）
   * - "header": ヘッダーの行の中央に置く小さめの形（`<AdminPage center={<AdminCouponSectionTabs variant="header" />}>`）
   */
  variant?: "body" | "header";
};

export function AdminCouponSectionTabs({ variant = "body" }: AdminCouponSectionTabsProps) {
  const tabs = buildCouponAdminSectionTabs();
  return variant === "header" ? (
    <SolidTabs tabs={tabs} ariaLabel={ARIA_LABEL} size="sm" listClassName="mx-auto max-w-2xl" />
  ) : (
    <SolidTabs tabs={tabs} ariaLabel={ARIA_LABEL} />
  );
}
