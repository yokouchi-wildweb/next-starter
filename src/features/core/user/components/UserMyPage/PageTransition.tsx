// src/features/core/user/components/UserMyPage/PageTransition.tsx

"use client";

import { useContext, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * ページ遷移中に前のページを保持するためのコンテキストフリーズ
 * AnimatePresence の exit アニメーション中に旧コンテンツを維持する
 */
function FrozenRouter({ children }: { children: ReactNode }) {
  const context = useContext(LayoutRouterContext);
  const frozen = useRef(context).current;

  return (
    <LayoutRouterContext.Provider value={frozen}>
      {children}
    </LayoutRouterContext.Provider>
  );
}

/** パスからページの深さを取得（スライド方向の判定に使用） */
function getDepth(pathname: string): number {
  // /mypage → 0, /mypage/account → 1, /mypage/account/* → 2
  const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  // "mypage" を基点として、それ以降のセグメント数
  const mypageIndex = segments.indexOf("mypage");
  return mypageIndex >= 0 ? segments.length - mypageIndex - 1 : 0;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : "100%",
    opacity: 0,
  }),
};

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentDepth = getDepth(pathname);
  const prevDepthRef = useRef(currentDepth);

  // 深さの差分でスライド方向を決定（1=前進, -1=後退）
  const direction = currentDepth >= prevDepthRef.current ? 1 : -1;

  // 次のレンダリングに備えて現在の深さを保存
  // pathname が変わった時点で更新
  if (currentDepth !== prevDepthRef.current) {
    prevDepthRef.current = currentDepth;
  }

  return (
    <div className="overflow-hidden">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={pathname}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <FrozenRouter>{children}</FrozenRouter>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
