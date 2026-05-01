// src/app/admin/(protected)/bank-transfer-reviews/_components/StatusTabs.tsx
//
// status 切替タブ。動的ルート /admin/bank-transfer-reviews/[status] と連動し、
// 切替で URL ごと遷移する。SolidTabs の useActiveTab が pathname を見て
// アクティブ判定するため、href は完全一致のパスを渡す。

"use client";

import { SolidTabs, type PageTabItem } from "@/components/Navigation";
import type { BankTransferReviewStatus } from "@/features/core/bankTransferReview";

import { STATUS_SLUG_BY_VALUE } from "./statusSlug";

const BASE_PATH = "/admin/bank-transfer-reviews";

const TAB_DEFINITIONS: { value: BankTransferReviewStatus; label: string }[] = [
  { value: "pending_review", label: "確認待ち" },
  { value: "confirmed", label: "承認済み" },
  { value: "rejected", label: "拒否" },
];

const TABS: PageTabItem[] = TAB_DEFINITIONS.map((tab) => ({
  value: tab.value,
  label: tab.label,
  href: `${BASE_PATH}/${STATUS_SLUG_BY_VALUE[tab.value]}`,
}));

export function StatusTabs() {
  return <SolidTabs tabs={TABS} ariaLabel="銀行振込レビュー ステータス切替" size="sm" />;
}
