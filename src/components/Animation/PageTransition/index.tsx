// src/components/Animation/PageTransition/index.tsx

"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { FrozenRouter } from "./FrozenRouter";

/** パスのセグメント数からページの深さを取得 */
function getDepth(pathname: string): number {
  return pathname.replace(/\/$/, "").split("/").filter(Boolean).length;
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

type PageTransitionProps = {
  children: ReactNode;
  /** アニメーション時間（秒） @default 0.3 */
  duration?: number;
};

/**
 * ページ遷移スライドアニメーション
 *
 * layout.tsx で children をラップして使用する。
 * usePathname() のセグメント数差分でスライド方向を自動判定する。
 * （深くなれば右→左、浅くなれば左→右）
 *
 * @example
 * // app/mypage/layout.tsx
 * <PageTransition>{children}</PageTransition>
 */
export function PageTransition({ children, duration = 0.3 }: PageTransitionProps) {
  const pathname = usePathname();
  const currentDepth = getDepth(pathname);
  // 深さの差分でスライド方向を決定（1=前進, -1=後退）
  // pathname が変わった render で前回の深さと比べて決め、次の遷移まで保持する(render 中に調整する)
  const [transition, setTransition] = useState({ pathname, depth: currentDepth, direction: 1 });
  let direction = transition.direction;
  if (transition.pathname !== pathname) {
    direction = currentDepth >= transition.depth ? 1 : -1;
    setTransition({ pathname, depth: currentDepth, direction });
  }

  return (
    <div className="overflow-hidden" style={{ contain: "layout paint" }}>
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={pathname}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration, ease: "easeInOut" }}
        >
          <FrozenRouter>{children}</FrozenRouter>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
