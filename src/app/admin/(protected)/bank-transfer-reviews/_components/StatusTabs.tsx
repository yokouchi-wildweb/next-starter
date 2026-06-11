// src/app/admin/(protected)/bank-transfer-reviews/_components/StatusTabs.tsx
//
// status 切替タブ。動的ルート /admin/bank-transfer-reviews/[status] と連動し、
// 切替で URL ごと遷移する。SolidTabs の useActiveTab が pathname を見て
// アクティブ判定するため、href は完全一致のパスを渡す。

"use client";

import { useMemo } from "react";

import { SolidTabs, type PageTabItem } from "@/components/Navigation";
import type { BankTransferReviewStatus } from "@/features/core/bankTransferReview";

import { STATUS_SLUG_BY_VALUE } from "./statusSlug";

const BASE_PATH = "/admin/bank-transfer-reviews";

const TAB_DEFINITIONS: { value: BankTransferReviewStatus; label: string }[] = [
  { value: "pending_review", label: "レビュー待ち" },
  { value: "needs_check", label: "要確認" },
  { value: "investigating", label: "検証中" },
  { value: "confirmed", label: "承認済み" },
  { value: "rejected", label: "拒否" },
];

type Props = {
  /**
   * status 別件数。未取得時は undefined。
   * 取得済みのキーだけ "(N)" 形式でラベル末尾に付与する。
   */
  counts?: Record<BankTransferReviewStatus, number>;
};

export function StatusTabs({ counts }: Props) {
  const tabs = useMemo<PageTabItem[]>(
    () =>
      TAB_DEFINITIONS.map((tab) => {
        const count = counts?.[tab.value];
        const label =
          typeof count === "number"
            ? `${tab.label}(${count.toLocaleString()})`
            : tab.label;
        return {
          value: tab.value,
          label,
          href: `${BASE_PATH}/${STATUS_SLUG_BY_VALUE[tab.value]}`,
        };
      }),
    [counts],
  );

  return <SolidTabs tabs={tabs} ariaLabel="銀行振込レビュー ステータス切替" size="sm" />;
}
