// src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/loader.ts
// /admin/bank-transfer-reviews/[status] の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: URL のスラッグ(pending-review / needs-check / investigating / confirmed / rejected)を status 値に直す。
// 定義外のスラッグは 404(想定外の URL を許容しない)。一覧の取得は部品 BankTransferReviewListPanel が hook で行う。

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import type { BankTransferReviewStatus } from "@/features/core/bankTransferReview";

import { STATUS_VALUE_BY_SLUG } from "./statusSlug";

export type AdminBankTransferReviewsScreenParams = { status: string };

export type AdminBankTransferReviewsScreenData = {
  status: BankTransferReviewStatus;
};

const resolveAdminBankTransferReviewsScreen = cache(async (slug: string): Promise<AdminBankTransferReviewsScreenData> => {
  const status = STATUS_VALUE_BY_SLUG[slug];
  if (!status) notFound();
  return { status };
});

export async function loadAdminBankTransferReviewsScreen(
  props: ScreenProps<AdminBankTransferReviewsScreenParams>,
): Promise<AdminBankTransferReviewsScreenData> {
  const { status } = await props.params;
  return resolveAdminBankTransferReviewsScreen(status);
}
