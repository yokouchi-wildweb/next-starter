/**
 * SP用ナビゲーション
 *
 * sm:640px 未満で表示
 * オーバーレイ + パネルで構成
 */

import type { ReactNode } from "react";

import { AnimatePresence, motion } from "framer-motion";

import { SpNavOverlay } from "./SpNavOverlay";
import { SpNavPanel } from "./SpNavPanel";
import type { NavigationMenuItem } from "../types";

export type SpNavigationProps = {
  readonly isOpen: boolean;
  readonly items: readonly NavigationMenuItem[];
  readonly showIcons?: boolean;
  readonly onClose: () => void;
  /** ヘッダーの実測の高さ(px)。banner がある時はその分(--app-banner-height)を足した位置から開く */
  readonly headerOffset: number;
  /** パネル下部に表示するコンテンツ（CTAボタンなど） */
  readonly footer?: ReactNode;
};

export const SpNavigation = ({
  isOpen,
  items,
  showIcons = true,
  onClose,
  headerOffset,
  footer,
}: SpNavigationProps) => {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div id="header-sp-nav" data-frame-part="header-nav" key="mobile-navigation" className="sm:hidden">
          <div id="header-sp-nav-container" className="fixed inset-x-0 bottom-0" style={{ top: `calc(var(--app-banner-height, 0px) + ${headerOffset}px)` }}>
            <SpNavOverlay onClose={onClose} />
            <SpNavPanel items={items} showIcons={showIcons} onNavigate={onClose} footer={footer} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
