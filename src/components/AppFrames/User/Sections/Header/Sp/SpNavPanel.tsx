/**
 * SPナビゲーションのパネル（右からスライドインするメニュー部分）
 */

import type { ReactNode } from "react";

import { motion } from "framer-motion";

import { SLIDE_TRANSITION, slideFromRightVariants } from "../animations";
import { SpMenuItem } from "./SpMenuItem";
import type { NavigationMenuItem } from "../types";

export type SpNavPanelProps = {
  readonly items: readonly NavigationMenuItem[];
  readonly showIcons?: boolean;
  readonly onNavigate: () => void;
  /** パネル下部に表示するコンテンツ（CTAボタンなど） */
  readonly footer?: ReactNode;
};

export const SpNavPanel = ({ items, showIcons = true, onNavigate, footer }: SpNavPanelProps) => (
  <motion.nav
    id="header-sp-nav-panel"
    className="relative modal-layer ml-auto flex h-full w-3/4 max-w-sm flex-col border-l border-border bg-header text-header-foreground shadow-2xl"
    variants={slideFromRightVariants}
    initial="hidden"
    animate="visible"
    exit="hidden"
    transition={SLIDE_TRANSITION}
  >
    <ul id="header-sp-nav-list" className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6 pt-6 text-base font-medium">
      {items.map((item) => (
        <li key={item.key} id={`header-sp-nav-item-${item.key}`}>
          <SpMenuItem item={item} showIcon={showIcons} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>

    {/* フッター領域（CTAボタンなど） */}
    {footer && (
      <div id="header-sp-nav-footer" className="border-t border-border px-4 py-4">
        {footer}
      </div>
    )}
  </motion.nav>
);
