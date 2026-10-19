// src/app/admin/(protected)/coupons/invite/_screen/loader.ts
// /admin/coupons/invite の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 紹介機能(APP_FEATURES.marketing.referral.enabled)が無効なら { enabled: false } だけを返す(Screen が案内を出す)。
// 有効なら招待コードを紹介人数付きで一覧する(?page= / ?searchQuery=、件数は設定の 1 ページ件数)。
// 認可は admin/(protected)/layout.tsx の authGuard が担うため、ここでは行わない。

import "server-only";
import { cache } from "react";

import { APP_FEATURES } from "@/config/app/app-features.config";
import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { referralService } from "@/features/core/referral/services/server/referralService";
import type { InviteCodeWithCount } from "@/features/core/referral/services/server/wrappers/getInviteCodeListWithCounts";
import { settingService } from "@/features/core/setting/services/server/settingService";

export type AdminCouponInviteListScreenData =
  | { enabled: false }
  | {
      enabled: true;
      items: InviteCodeWithCount[];
      page: number;
      perPage: number;
      total: number;
    };

const resolveAdminCouponInviteListScreen = cache(
  async (page: number, searchQuery: string | undefined): Promise<AdminCouponInviteListScreenData> => {
    if (!APP_FEATURES.marketing.referral.enabled) {
      return { enabled: false };
    }
    const perPage = await settingService.getAdminListPerPage();
    const { items, total } = await referralService.getInviteCodeListWithCounts({ page, limit: perPage, searchQuery });
    return { enabled: true, items, page, perPage, total };
  },
);

export async function loadAdminCouponInviteListScreen(
  props: ScreenProps<Record<string, never>, ListPageSearchParams>,
): Promise<AdminCouponInviteListScreenData> {
  const { page, searchQuery } = await props.searchParams;
  return resolveAdminCouponInviteListScreen(Number(page ?? "1"), searchQuery);
}
