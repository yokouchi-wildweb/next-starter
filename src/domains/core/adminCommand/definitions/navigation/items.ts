"use client";

import { useMemo } from "react";

import { useGate } from "@/featureGate/client";

import { adminCommandNavigationItems } from "../../extensions/adminCommandNavigationItems";
import type { NavigationItem } from "../../types";

/** ナビゲーション先の一覧(閉じたドメインの項目は門番 useGate().plugs で外す)。足すときは <ドメイン>/plugs/adminCommandNavigationItems/<名前>.ts */
export function useNavigationItems(): NavigationItem[] {
  const gate = useGate();
  return useMemo(() => gate.plugs(adminCommandNavigationItems).flatMap((entry) => entry.plug), [gate]);
}
