// src/components/Animation/PageTransition/FrozenRouter.tsx

"use client";

import { useContext, useRef, type ReactNode } from "react";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * ページ遷移中に前のページを保持するためのコンテキストフリーズ
 * AnimatePresence の exit アニメーション中に旧コンテンツを維持する
 */
export function FrozenRouter({ children }: { children: ReactNode }) {
  const context = useContext(LayoutRouterContext);
  const frozen = useRef(context).current;

  return (
    <LayoutRouterContext.Provider value={frozen}>
      {children}
    </LayoutRouterContext.Provider>
  );
}
