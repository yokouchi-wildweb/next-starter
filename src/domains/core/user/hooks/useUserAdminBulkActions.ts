// src/domains/core/user/hooks/useUserAdminBulkActions.ts
// user の管理一覧に出す一括操作の項目(点 adminBulkActions の user の項目を、一覧の名前・enabled・access・閉じた機能(feature、useGate)で絞って並べる。閉じたドメインの項目は useDomainAdminBulkActions が外す)

"use client";

import { useMemo } from "react";

import { useGate } from "@/featureGate/client";
import { selectBulkActions } from "@/lib/tableSuite";
import { useDomainAdminBulkActions } from "@/domains/core/admin/hooks/useDomainAdminBulkActions";
import type { UserAdminBulkActionItem } from "@/domains/core/user/types";

import { useAdminBulkActionCan } from "./useAdminBulkActionCan";

/** list: "general"(一般)/ "managerial"(システム管理者)/ "demo"(デモ) */
export function useUserAdminBulkActions(list: "general" | "managerial" | "demo"): UserAdminBulkActionItem[] {
  const can = useAdminBulkActionCan();
  const gate = useGate();
  const items = useDomainAdminBulkActions<UserAdminBulkActionItem>("user");
  return useMemo(
    () =>
      selectBulkActions(
        items.filter((item) => item.feature === undefined || gate.enabled(item.feature)),
        { list, can },
      ),
    [items, list, can, gate],
  );
}
