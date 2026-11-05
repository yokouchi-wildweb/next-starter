// src/app/admin/(protected)/coupons/_screen/CouponSectionTabs.tsx
//
// クーポン管理画面のセクションタブ（official / affiliate / invite + downstream 登録分）。
// タブの中身は buildCouponAdminSectionTabs()（registry 込み）が唯一の定義源。
// 配置（本文 or ヘッダー中央）はページの関心事なので、一覧コンポーネントではなく
// Screen がこのコンポーネントを置いて決める（ヘッダー中央 = AdminPage の center。bank-transfer-reviews の StatusTabs と同じ型）。
// coupons/* の Screen の部品。上流の 3 ルート(official / affiliate / invite)と、下流の追加セクションの Screen が読む
// (下流は `@/app/...` ではなく相対パス `../_screen/CouponSectionTabs` で import する)。

"use client";

import { AdminHeaderPortal } from "@/components/AppFrames/Admin/Elements/AdminHeaderPortal";
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
  /**
   * @deprecated 置き場はページが AdminPage の `center` で決める（上のとおり）。"header" = 前と同じく AdminHeaderPortal で
   * ヘッダー中央の受け口へ差し込む互換で、上流の使用は 0。portal と受け口の id を消す指令 17 で一緒に消す
   */
  placement?: "body" | "header";
};

export function CouponSectionTabs({ variant = "body", placement = "body" }: Props) {
  const tabs = buildCouponAdminSectionTabs();
  const headerTabs = <SolidTabs tabs={tabs} ariaLabel={ARIA_LABEL} size="sm" listClassName="mx-auto max-w-2xl" />;

  if (placement === "header") {
    return <AdminHeaderPortal slot="center">{headerTabs}</AdminHeaderPortal>;
  }

  return variant === "header" ? headerTabs : <SolidTabs tabs={tabs} ariaLabel={ARIA_LABEL} />;
}
