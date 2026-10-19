// src/app/admin/(protected)/users/demo/_screen/loader.ts
// /admin/users/demo の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: ?page= / ?searchQuery= / ?sortBy= を解釈し、設定の 1 ページ件数で検索する。
// 絞り込み・並び順・電話番号検索の正規化は buildAdminUserListQuery(3 つのユーザー一覧で共有)。
// 認可は admin/(protected)/layout.tsx の authGuard が担うため、ここでは行わない。

import "server-only";
import { cache } from "react";

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import type { User } from "@/features/core/user/entities";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { userService } from "@/features/core/user/services/server/userService";
import { buildAdminUserListQuery } from "@/features/core/user/utils/adminUserListQuery";

export type AdminDemoUserListScreenData = {
  users: User[];
  /** 1 始まりの現在ページ */
  page: number;
  /** 1 ページの件数(設定 adminListPerPage) */
  perPage: number;
  total: number;
  sortBy: string | undefined;
};

const resolveAdminDemoUserListScreen = cache(
  async (page: number, searchQuery: string | undefined, sortBy: string | undefined): Promise<AdminDemoUserListScreenData> => {
    const perPage = await settingService.getAdminListPerPage();
    const query = buildAdminUserListQuery({ demo: true }, sortBy, searchQuery);
    const { results: users, total } = await userService.search({ page, limit: perPage, ...query });
    return { users, page, perPage, total, sortBy };
  },
);

export async function loadAdminDemoUserListScreen(
  props: ScreenProps<Record<string, never>, ListPageSearchParams>,
): Promise<AdminDemoUserListScreenData> {
  const { page, searchQuery, sortBy } = await props.searchParams;
  return resolveAdminDemoUserListScreen(Number(page ?? "1"), searchQuery, sortBy);
}
