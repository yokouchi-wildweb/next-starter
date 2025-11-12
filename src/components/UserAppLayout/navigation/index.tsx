"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { DesktopNavigation } from "./DesktopNavigation";
import { MobileNavigation } from "./MobileNavigation";
import { NavigationBrand } from "./NavigationBrand";
import { NavigationToggleButton } from "./NavigationToggleButton";
import { APP_HEADER_ELEMENT_ID } from "@/constants/layout";

import { useUserNavItems } from "./useUserNavItems";

export const UserNavigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { navItems } = useUserNavItems();

  const handleClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleToggle = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    handleClose();
  }, [handleClose, pathname]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleResize = () => {
      if (window.innerWidth >= 640) {
        handleClose();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [handleClose, isMenuOpen]);

  return (
    <header
      id={APP_HEADER_ELEMENT_ID}
      className="header-layer w-full border-b border-border bg-card md:fixed md:inset-x-0 md:top-0"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <NavigationBrand />
        <NavigationToggleButton isMenuOpen={isMenuOpen} onToggle={handleToggle} />
        <DesktopNavigation items={navItems} />
      </div>
      <MobileNavigation isOpen={isMenuOpen} items={navItems} onClose={handleClose} />
    </header>
  );
};
