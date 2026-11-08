// src/features/core/adminCommand/base/AdminCommandGateBridge.tsx
// 管理の枠の門番をパレットに渡す橋(L2.4)。パレットは AppProviders(利用者の枠の GateProvider の内)に置かれ、
// 管理の枠の値(clientGateState("admin"))は admin の守りの layout 2 つが children だけを包むので、パレットからは届かない。
// この部品を管理の枠の GateProvider の内に置くと、移動の候補の絞り込みを登録し、外れたら外す。
// 判定は厳密な gate.path(管理メニューと同じ、メニューの議会 D22・L2.5): 住所が閉じた規則に当たれば redirectTo の有無に関わらず隠す。
// 外部 URL・'/' で始まらない住所・開いた住所は残す。'?' と '#' の後ろは照合から外す
// 置き場: src/app/admin/(protected)/layout.tsx・src/app/admin/insane/layout.tsx(管理の枠の値を root で計算しない: L1.7)

"use client";

import { useContext, useEffect } from "react";

import { useGate } from "@/featureGate/client";

import { AdminCommandContext } from "./context";
import type { NavigationFilter } from "./types";

/** 候補の href の内部の住所('/' で始まり '//' でない物の、'?' と '#' より前)。内部でなければ null */
function internalPathname(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  return href.split(/[?#]/, 1)[0];
}

/** 厳密な絞り込み: 内部の住所で gate.path が閉なら隠す(redirectTo 付きの閉も) */
export function strictNavigationFilter(path: ReturnType<typeof useGate>["path"]): NavigationFilter {
  return (items) =>
    items.filter((item) => {
      const pathname = internalPathname(item.href);
      return pathname === null || path(pathname).open;
    });
}

export function AdminCommandGateBridge(): null {
  const gate = useGate();
  const setNavigationFilter = useContext(AdminCommandContext)?.setNavigationFilter;
  useEffect(() => {
    if (!setNavigationFilter) return;
    setNavigationFilter(strictNavigationFilter(gate.path));
    return () => setNavigationFilter(null);
  }, [gate, setNavigationFilter]);
  return null;
}
