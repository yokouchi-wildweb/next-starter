// src/domains/core/messaging/components/AdminMessagingSectionTabs/index.tsx
//
// 部品: 通知の管理画面(送信一覧・テンプレート・システム通知)のセクションタブ。
// タブの中身は buildMessagingAdminSectionTabs(門が閉の画面は外す)が唯一の定義源。門は useGate で読む。
// 置き場所(ヘッダー中央 or 本文)は Screen が決める(クーポン管理の AdminCouponSectionTabs と同じ型)。

"use client";

import { SolidTabs } from "@/components/Navigation/PageTab";
import { useGate } from "@/featureGate/client";

import { buildMessagingAdminSectionTabs } from "@/domains/core/messaging/lib/adminSectionTabs";

const ARIA_LABEL = "通知の管理";

export type AdminMessagingSectionTabsProps = {
  /**
   * 見た目:
   * - "body": ページ本文の大きさ(既定)
   * - "header": ヘッダーの行の中央に置く小さめの形(`<AdminPage center={<AdminMessagingSectionTabs variant="header" />}>`)
   */
  variant?: "body" | "header";
};

export function AdminMessagingSectionTabs({ variant = "body" }: AdminMessagingSectionTabsProps) {
  const gate = useGate();
  const tabs = buildMessagingAdminSectionTabs((name) => gate.enabled(name));
  return variant === "header" ? (
    <SolidTabs tabs={tabs} ariaLabel={ARIA_LABEL} size="sm" listClassName="mx-auto max-w-2xl" />
  ) : (
    <SolidTabs tabs={tabs} ariaLabel={ARIA_LABEL} />
  );
}
