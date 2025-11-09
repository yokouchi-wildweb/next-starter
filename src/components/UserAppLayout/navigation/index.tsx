"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { DesktopNavigation } from "./DesktopNavigation";
import { MobileNavigation } from "./MobileNavigation";
import { NavigationBrand } from "./NavigationBrand";
import { NavigationToggleButton } from "./NavigationToggleButton";
import { useUserNavItems } from "./useUserNavItems";

type UserNavigationProps = {
  readonly onHeightChange?: (height: number) => void;
};

export const UserNavigation = ({ onHeightChange }: UserNavigationProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { navItems } = useUserNavItems();
  const headerRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleToggle = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    handleClose();
  }, [handleClose, pathname]);

  const reportHeight = useCallback(() => {
    const height = headerRef.current?.offsetHeight;
    if (height != null) {
      onHeightChange?.(height);
    }
  }, [onHeightChange]);

  useEffect(() => {
    reportHeight();
  }, [reportHeight]);

  useEffect(() => {
    const element = headerRef.current;
    if (!element) {
      return;
    }

    reportHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", reportHeight);
      return () => {
        window.removeEventListener("resize", reportHeight);
      };
    }

    const observer = new ResizeObserver(() => {
      reportHeight();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [reportHeight]);

  useEffect(() => {
    reportHeight();
  }, [isMenuOpen, navItems, reportHeight]);

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
      ref={headerRef}
      className="fixed inset-x-0 top-0 header-layer border-b border-border bg-card"
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
