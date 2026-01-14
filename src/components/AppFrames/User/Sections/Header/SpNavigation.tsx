/**
 * SP用ナビゲーション
 *
 * sm:640px 未満で表示
 */

import { AnimatePresence, motion } from "framer-motion";

import {
  FADE_TRANSITION,
  SLIDE_TRANSITION,
  overlayVariants,
  slideFromRightVariants,
} from "./animations";
import { SpMenuItem } from "./SpMenuItem";
import type { NavigationMenuItem } from "./types";

export type SpNavigationProps = {
  readonly isOpen: boolean;
  readonly items: readonly NavigationMenuItem[];
  readonly showIcons?: boolean;
  readonly onClose: () => void;
  readonly headerOffset: number;
};

export const SpNavigation = ({ isOpen, items, showIcons = true, onClose, headerOffset }: SpNavigationProps) => {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div key="mobile-navigation" className="sm:hidden">
          <div className="fixed inset-x-0 bottom-0" style={{ top: headerOffset }}>
            <motion.button
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
            <motion.nav
              className="relative modal-layer ml-auto flex h-full w-3/4 max-w-sm flex-col border-l border-border bg-header text-header-foreground shadow-2xl"
              variants={slideFromRightVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={SLIDE_TRANSITION}
            >
              <ul className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6 pt-6 text-base font-medium">
                {items.map((item) => (
                  <li key={item.key}>
                    <SpMenuItem item={item} showIcon={showIcons} onNavigate={onClose} />
                  </li>
                ))}
              </ul>
            </motion.nav>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
