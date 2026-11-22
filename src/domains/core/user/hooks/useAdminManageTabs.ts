// src/domains/core/user/hooks/useAdminManageTabs.ts
// 管理のユーザー管理モーダルに足すタブ(受け口 adminManageTabs)を、閉じた機能(feature、useGate)と
// 上流のタブと重なる key を外して order → key の順に並べる

"use client";

import { useMemo } from "react";

import { useGate } from "@/featureGate/client";
import { adminManageTabs } from "@/domains/core/user/extensions/adminManageTabs";
import type { UserAdminManageTabItem } from "@/domains/core/user/types";

/** AdminUserManageModal の上流のタブの value(受け口の項目はこれと重ねられない) */
export const ADMIN_MANAGE_UPSTREAM_TAB_KEYS = ["summary", "auth", "status", "role", "delete", "history"] as const;

/** 受け口の項目を絞って並べる(純関数。isEnabled = 機能が開いているか) */
export function selectAdminManageTabs(
  items: readonly UserAdminManageTabItem[],
  isEnabled: (feature: NonNullable<UserAdminManageTabItem["feature"]>) => boolean,
): UserAdminManageTabItem[] {
  const upstream = new Set<string>(ADMIN_MANAGE_UPSTREAM_TAB_KEYS);
  return items
    .filter((item) => {
      if (upstream.has(item.key)) {
        // fork の置き方の誤り: 段階を問わず知らせる(上流のタブは置き換えられない)
        console.warn(`adminManageTabs: key "${item.key}" は上流のタブと重なるので出さない(上流のタブは置き換えられない)`);
        return false;
      }
      return item.feature === undefined || isEnabled(item.feature);
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.key.localeCompare(b.key));
}

/** 管理のユーザー管理モーダルに足すタブ(閉じた機能の項目は除く) */
export function useAdminManageTabs(): UserAdminManageTabItem[] {
  const gate = useGate();
  return useMemo(() => selectAdminManageTabs(Object.values(adminManageTabs), (feature) => gate.enabled(feature)), [gate]);
}
