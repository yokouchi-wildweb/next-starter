// src/domains/core/admin/hooks/useAdminMenu.ts
// 管理のサイドバーが描くメニュー(カテゴリーと行)。見る人のロールと、管理の枠の門番の値(useGate().path)で絞る。
// カテゴリーと項目は plugs の点(差す側の <ドメイン>/plugs/adminMenuCategories・adminMenuItems/)で、閉じたドメインの物は useGate().plugs が外す。
// 管理の範囲(/admin)の外の住所・外部 URL は門番に聞かず開いているとみなす(useGate は範囲の外で dev に throw するため)。仕組み: ../menu/README.md

"use client";

import { useMemo } from "react";

import { useGate } from "@/featureGate/client";
import { adminMenuCategories } from "@/domains/core/admin/extensions/adminMenuCategories";
import { adminMenuItems } from "@/domains/core/admin/extensions/adminMenuItems";
import { byKey } from "@/domains/core/admin/menu/byKey";
import { buildAdminMenu } from "@/domains/core/admin/menu/buildAdminMenu";
import { adminMenuSources } from "@/domains/core/admin/menu/sources";
import type { AdminMenuBuiltCategory } from "@/domains/core/admin/menu/types";
import { useAuthSession } from "@/domains/core/auth/hooks/useAuthSession";
import { matchesPath } from "@/lib/pathPattern/index.mjs";
import { adminDomains } from "@/registry/adminDomains";

const ADMIN_AREA = "/admin";

/** 管理の範囲の中の住所か(? と # は外す) */
const inAdminArea = (href: string): boolean => matchesPath(href.replace(/[?#].*$/, ""), ADMIN_AREA);

export function useAdminMenu(): AdminMenuBuiltCategory[] {
  const { user } = useAuthSession();
  const gate = useGate();
  return useMemo(
    () =>
      buildAdminMenu({
        categories: byKey(gate.plugs(adminMenuCategories)),
        items: byKey(gate.plugs(adminMenuItems)),
        domains: adminDomains,
        sources: adminMenuSources(gate.plugs),
        role: user?.role,
        isClosed: (href) => inAdminArea(href) && !gate.path(href.replace(/[?#].*$/, "")).open,
      }).categories,
    [user?.role, gate],
  );
}
