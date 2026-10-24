// src/components/Animation/PageTransition/FrozenRouter.tsx

"use client";

import { useContext, useState, type ReactNode } from "react";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * ページ遷移中に前のページを保持するためのコンテキストフリーズ
 * AnimatePresence の exit アニメーション中に旧コンテンツを維持する
 */
export function FrozenRouter({ children }: { children: ReactNode }) {
  const context = useContext(LayoutRouterContext);
  // 最初の render の値を保持し続ける(以後のコンテキスト変化は反映しない)
  const [frozen] = useState(context);

  return (
    <LayoutRouterContext.Provider value={frozen}>
      {children}
    </LayoutRouterContext.Provider>
  );
}
