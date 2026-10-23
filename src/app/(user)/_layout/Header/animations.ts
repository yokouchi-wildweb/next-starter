/**
 * Header コンポーネントのアニメーション設定
 *
 * framer-motion で使用する定数を一元管理
 */

import type { Transition, Variants } from "framer-motion";

// ============================================
// トランジション設定
// ============================================

/** フェードイン/アウト用（オーバーレイなど） */
export const FADE_TRANSITION: Transition = {
  duration: 0.2,
};

/** スライドイン/アウト用（SPナビパネル） */
export const SLIDE_TRANSITION: Transition = {
  duration: 0.3,
  ease: "easeInOut",
};

/** アコーディオン展開/収縮用 */
export const ACCORDION_TRANSITION: Transition = {
  duration: 0.2,
};

// ============================================
// Variants（アニメーション状態定義）
// ============================================

/** オーバーレイのフェード */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** 右からスライドイン */
export const slideFromRightVariants: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0 },
};

/** アコーディオン展開 */
export const accordionVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "auto", opacity: 1 },
};
