import { AnimatePresence, motion } from "framer-motion";

import { MenuItem } from "./MenuItem";
import type { NavigationMenuItem } from "./MenuItem";

export type MobileNavigationProps = {
  readonly isOpen: boolean;
  readonly items: readonly NavigationMenuItem[];
  readonly onClose: () => void;
  readonly headerOffset: number;
};

export const SpNavigation = ({ isOpen, items, onClose, headerOffset }: MobileNavigationProps) => {
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.nav
              className="relative modal-layer ml-auto flex h-full w-3/4 max-w-sm flex-col border-l border-border bg-card shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <ul className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6 pt-6 text-base font-medium">
                {items.map((item) => (
                  <li key={item.key}>
                    <MenuItem item={item} variant="mobile" onNavigate={onClose} />
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
