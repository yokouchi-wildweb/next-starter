"use client";

import type { CSSProperties } from "react";

import { AnimatePresence, motion, type Variants } from "framer-motion";

import type { NavItem } from "./types";
import { NavigationItem } from "./NavigationItem";

export type MobileNavigationProps = {
  readonly isOpen: boolean;
  readonly items: readonly NavItem[];
  readonly onClose: () => void;
  readonly headerOffset: number;
};

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const drawerVariants: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0 },
};

export const MobileNavigation = ({ isOpen, items, onClose, headerOffset }: MobileNavigationProps) => {
  const headerStyle: CSSProperties = { top: headerOffset };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div key="mobile-navigation" className="sm:hidden">
          <motion.button
            type="button"
            aria-label="メニューを閉じる"
            className="fixed inset-x-0 bottom-0 h-full w-full bg-black/50"
            style={{ ...headerStyle, zIndex: "var(--z-layer-below-header)" }}
            onClick={onClose}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
          />
          <motion.nav
            role="dialog"
            aria-modal="true"
            className="fixed bottom-0 right-0 flex h-full w-3/4 max-w-sm flex-col border-l border-border bg-card shadow-2xl modal-layer"
            style={headerStyle}
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
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
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
