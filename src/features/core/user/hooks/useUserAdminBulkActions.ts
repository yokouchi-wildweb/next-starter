// src/features/core/user/hooks/useUserAdminBulkActions.ts
// user の管理一覧に出す一括操作の項目(受け口 adminBulkActions を、一覧の名前・enabled・access で絞って並べる)

"use client";

import { useMemo } from "react";

import { selectBulkActions } from "@/lib/tableSuite";
import { adminBulkActions } from "@/features/core/user/extensions/adminBulkActions";
import type { UserAdminBulkActionItem } from "@/features/core/user/types";

import { useAdminBulkActionCan } from "./useAdminBulkActionCan";

/** list: "general"(一般)/ "managerial"(システム管理者)/ "demo"(デモ) */
export function useUserAdminBulkActions(list: "general" | "managerial" | "demo"): UserAdminBulkActionItem[] {
  const can = useAdminBulkActionCan();
  return useMemo(() => selectBulkActions(Object.values(adminBulkActions), { list, can }), [list, can]);
}
