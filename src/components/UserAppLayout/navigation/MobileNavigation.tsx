import { AnimatePresence, motion, type Variants } from "framer-motion";

import type { NavItem } from "./types";
import { NavigationItem } from "./NavigationItem";

export type MobileNavigationProps = {
  readonly isOpen: boolean;
  readonly items: readonly NavItem[];
  readonly onClose: () => void;
  readonly headerOffset: number;
};

const slideInFromRight: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0 },
};

export const MobileNavigation = ({ isOpen, items, onClose, headerOffset }: MobileNavigationProps) => {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div key="mobile-navigation" className="sm:hidden">
          <div className="fixed inset-x-0 bottom-0 flex" style={{ top: headerOffset }}>
            <motion.button
              type="button"
              aria-label="メニューを閉じる"
              className="absolute inset-0 h-full w-full bg-black/50 below-header-layer"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ zIndex: "var(--z-layer-below-header)" }}
            />
            <motion.nav
              className="relative ml-auto modal-layer flex h-full w-3/4 max-w-sm flex-col border-l border-border bg-card shadow-2xl"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={slideInFromRight}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <ul className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6 pt-6 text-base font-medium">
                {items.map((item) => (
                  <li key={item.key}>
                    <NavigationItem item={item} variant="mobile" onNavigate={onClose} />
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
