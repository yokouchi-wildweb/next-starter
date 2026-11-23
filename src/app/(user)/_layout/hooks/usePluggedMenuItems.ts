// src/app/(user)/_layout/hooks/usePluggedMenuItems.ts
// 点 userMenuItems の差した項目のうち、開いているドメインの物を 1 つのメニュー(ヘッダー / ボトムナビ)分だけ返す。
// 枠はドメインを読まない(D25): 項目は生成された一覧 ../extensions/userMenuItems.ts から、閉じたドメインの物は門番(useGate().plugs)が外す

"use client";

import { useMemo } from "react";

import { useGate } from "@/featureGate/client";

import type { BottomNavItem, HeaderMenuItem } from "../config.ui";
import { userMenuItems } from "../extensions/userMenuItems";
import type { MenuPlug } from "./mergeMenuItems";

type MenuEntry = { header: HeaderMenuItem; bottomNav: BottomNavItem };

export const usePluggedMenuItems = <M extends keyof MenuEntry>(menu: M): MenuPlug<MenuEntry[M]>[] => {
  const open = useGate().plugs(userMenuItems);
  return useMemo(
    () =>
      open
        .map(({ plug }) => plug)
        .filter((plug): plug is Extract<typeof plug, { menu: M }> => plug.menu === menu)
        .map((plug) => ({ audience: plug.audience, after: plug.after, entry: plug.entry as MenuEntry[M] })),
    [open, menu],
  );
};
