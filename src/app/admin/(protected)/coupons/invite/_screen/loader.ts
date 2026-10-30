// src/app/admin/(protected)/coupons/invite/_screen/loader.ts
// /admin/coupons/invite の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 紹介機能(APP_FEATURES.marketing.referral.enabled)が無効なら { enabled: false } だけを返す(Screen が案内を出す)。
// 有効なら招待コードを紹介人数付きで一覧する(?page= / ?searchQuery=、件数は設定の 1 ページ件数)。
// 認可は範囲 admin/(protected)/guard.ts の createLoader(access 管理者カテゴリ)。取得の前に評価する。

import "server-only";

import { APP_FEATURES } from "@/config/app/app-features.config";
import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { referralService } from "@/features/core/referral/services/server/referralService";
import type { InviteCodeWithCount } from "@/features/core/referral/services/server/wrappers/getInviteCodeListWithCounts";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { createLoader } from "@/app/admin/(protected)/guard";

export type AdminCouponInviteListScreenData =
  | { enabled: false }
  | {
      enabled: true;
      items: InviteCodeWithCount[];
      page: number;
      perPage: number;
      total: number;
    };

export const loadAdminCouponInviteListScreen = createLoader({
  access: { roleCategories: ["admin"] },
  key: async (props: ScreenProps<Record<string, never>, ListPageSearchParams>): Promise<[number, string | undefined]> => {
    const { page, searchQuery } = await props.searchParams;
    return [Number(page ?? "1"), searchQuery];
  },
  load: async (_ctx, page, searchQuery): Promise<AdminCouponInviteListScreenData> => {
    if (!APP_FEATURES.marketing.referral.enabled) {
      return { enabled: false };
    }
    const perPage = await settingService.getAdminListPerPage();
    const { items, total } = await referralService.getInviteCodeListWithCounts({ page, limit: perPage, searchQuery });
    return { enabled: true, items, page, perPage, total };
  },
});

