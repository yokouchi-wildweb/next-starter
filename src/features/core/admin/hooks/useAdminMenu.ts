// src/features/core/admin/hooks/useAdminMenu.ts
// 管理のサイドバーが描くメニュー(カテゴリーと行)。見る人のロールと、管理の枠の門番の値(useGate().path)で絞る。
// 管理の範囲(/admin)の外の住所・外部 URL は門番に聞かず開いているとみなす(useGate は範囲の外で dev に throw するため)。仕組み: ../menu/README.md

"use client";

import { useMemo } from "react";

import { useGate } from "@/featureGate/client";
import { menuCategories } from "@/features/core/admin/extensions/menuCategories";
import { menuItems } from "@/features/core/admin/extensions/menuItems";
import { buildAdminMenu } from "@/features/core/admin/menu/buildAdminMenu";
import { adminMenuSources } from "@/features/core/admin/menu/sources";
import type { AdminMenuBuiltCategory } from "@/features/core/admin/menu/types";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
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
        categories: menuCategories,
        items: menuItems,
        domains: adminDomains,
        sources: adminMenuSources(),
        role: user?.role,
        isClosed: (href) => inAdminArea(href) && !gate.path(href.replace(/[?#].*$/, "")).open,
      }).categories,
    [user?.role, gate],
  );
}
