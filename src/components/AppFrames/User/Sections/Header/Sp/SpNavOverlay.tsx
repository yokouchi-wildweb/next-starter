/**
 * SPナビゲーションのオーバーレイ（背景の半透明部分）
 *
 * クリックでメニューを閉じる
 */

import { motion } from "framer-motion";

import { FADE_TRANSITION, overlayVariants } from "../animations";

export type SpNavOverlayProps = {
  readonly onClose: () => void;
};

export const SpNavOverlay = ({ onClose }: SpNavOverlayProps) => (
  <motion.button
    id="header-sp-nav-overlay"
    type="button"
    aria-label="メニューを閉じる"
    className="absolute inset-0 h-full w-full bg-black/50 below-header-layer"
    onClick={onClose}
    variants={overlayVariants}
    initial="hidden"
    animate="visible"
    exit="hidden"
    transition={FADE_TRANSITION}
  />
);
