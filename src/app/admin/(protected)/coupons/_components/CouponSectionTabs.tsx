// src/app/admin/(protected)/coupons/_components/CouponSectionTabs.tsx
//
// クーポン管理画面のセクションタブ（official / affiliate / invite + downstream 登録分）。
// タブの中身は buildCouponAdminSectionTabs()（registry 込み）が唯一の定義源。
// 配置（本文 or ヘッダー中央）はページの関心事なので、一覧コンポーネントではなく
// page.tsx がこのコンポーネントを置いて決める（bank-transfer-reviews の StatusTabs と同じ型）。

"use client";

import { AdminHeaderPortal } from "@/components/AppFrames/Admin/Elements/AdminHeaderPortal";
import { SolidTabs } from "@/components/Navigation";
import { buildCouponAdminSectionTabs } from "@/features/core/coupon/lib/adminSectionTabs";

const ARIA_LABEL = "クーポン種別";

type Props = {
  /**
   * 配置先:
   * - "body": ページ本文のその場に描画（デフォルト）
   * - "header": 管理画面ヘッダー中央スロット（AdminHeaderPortal slot="center"）に描画
   */
  placement?: "body" | "header";
};

export function CouponSectionTabs({ placement = "body" }: Props) {
  const tabs = buildCouponAdminSectionTabs();

  if (placement === "header") {
    return (
      <AdminHeaderPortal slot="center">
        <SolidTabs
          tabs={tabs}
          ariaLabel={ARIA_LABEL}
          size="sm"
          listClassName="mx-auto max-w-2xl"
        />
      </AdminHeaderPortal>
    );
  }

  return <SolidTabs tabs={tabs} ariaLabel={ARIA_LABEL} />;
}
