// src/features/core/adminCommand/base/AdminCommandGateBridge.tsx
// 管理の枠の門番をパレットに渡す橋(L2.4)。パレットは AppProviders(利用者の枠の GateProvider の内)に置かれ、
// 管理の枠の値(clientGateState("admin"))は admin の守りの layout 2 つが children だけを包むので、パレットからは届かない。
// この部品を管理の枠の GateProvider の内に置くと、useGate().filter を移動の候補の絞り込みとして登録し、外れたら外す。
// 置き場: src/app/admin/(protected)/layout.tsx・src/app/admin/insane/layout.tsx(管理の枠の値を root で計算しない: L1.7)

"use client";

import { useContext, useEffect } from "react";

import { useGate } from "@/featureGate/client";

import { AdminCommandContext } from "./context";

export function AdminCommandGateBridge(): null {
  const gate = useGate();
  const setNavigationFilter = useContext(AdminCommandContext)?.setNavigationFilter;
  useEffect(() => {
    if (!setNavigationFilter) return;
    setNavigationFilter((items) => gate.filter(items));
    return () => setNavigationFilter(null);
  }, [gate, setNavigationFilter]);
  return null;
}
