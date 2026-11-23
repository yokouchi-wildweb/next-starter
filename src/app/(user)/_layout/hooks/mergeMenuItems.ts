// src/app/(user)/_layout/hooks/mergeMenuItems.ts
// 設定のメニュー項目に、点 userMenuItems の差した項目を重ねる(純粋な関数。ヘッダーとボトムナビの 2 つのフックが使う)。
// 差した項目は after の鍵の項目の直後へ、差した順(点の並び)のまま入る。after が無い・設定に無い鍵 = 末尾

import type { UserMenuAudience } from "../config.ui";

export type MenuPlug<T> = { readonly audience: UserMenuAudience; readonly after?: string; readonly entry: T };

export const mergeMenuItems = <T extends { readonly key: string }>(
  base: readonly T[],
  plugs: readonly MenuPlug<T>[],
  isAuthenticated: boolean,
): T[] => {
  const audience: UserMenuAudience = isAuthenticated ? "authenticated" : "guest";
  const mine = plugs.filter((plug) => plug.audience === "all" || plug.audience === audience);
  if (mine.length === 0) return [...base];
  const keys = new Set(base.map((item) => item.key));
  const merged: T[] = [];
  for (const item of base) {
    merged.push(item);
    for (const plug of mine) if (plug.after === item.key) merged.push(plug.entry);
  }
  for (const plug of mine) if (plug.after === undefined || !keys.has(plug.after)) merged.push(plug.entry);
  return merged;
};
