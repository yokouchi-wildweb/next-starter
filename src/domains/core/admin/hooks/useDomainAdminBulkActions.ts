// src/domains/core/admin/hooks/useDomainAdminBulkActions.ts
// そのドメインの管理一覧に効く一括操作の項目(点 adminBulkActions の項目のうち <ドメイン>/plugs/adminBulkActions/ の物)。
// 門番で閉じたドメインの項目と、requires の相手が閉じた項目は外す(useGate().plugs、D26)。並べ方・権限の絞りは呼び手が selectBulkActions で

"use client";

import { useMemo } from "react";

import { useGate } from "@/featureGate/client";
import { adminBulkActions } from "@/domains/core/admin/extensions/adminBulkActions";
import type { AdminBulkActionItem } from "@/domains/core/admin/types/adminBulkAction";

/** domain = 一覧のドメインのフォルダ名(src/domains/<名前> か src/domains/core/<名前>)。Item = そのドメインの項目の型 */
export function useDomainAdminBulkActions<Item extends AdminBulkActionItem = AdminBulkActionItem>(domain: string): Item[] {
  const gate = useGate();
  return useMemo(() => gate.plugs(adminBulkActions).filter((entry) => entry.domain === domain).map((entry) => entry.plug as Item), [gate, domain]);
}
