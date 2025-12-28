"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { PcNavigation } from "./PcNavigation";
import { SpNavigation } from "./SpNavigation";
import { Brand } from "./Brand";
import { SpNavSwitch } from "./SpNavSwitch";
import { APP_HEADER_ELEMENT_ID } from "@/constants/layout";
import { HEADER_ENABLED } from "@/config/ui/user-header.config";

import { useHeaderVisibility } from "../../contexts/HeaderVisibilityContext";
import { useHeaderNavVisibility } from "../../contexts/HeaderNavVisibilityContext";
import { useUserMenuItems } from "./useUserMenuItems";

export const UserNavigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(0);
  const headerRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const { navItems, enabled: menuEnabled } = useUserMenuItems();
  const { visibility } = useHeaderVisibility();
  const { visibility: navVisibility } = useHeaderNavVisibility();

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

  useEffect(() => {
    const element = headerRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      setHeaderOffset(element.offsetHeight);
    };

    updateHeight();

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateHeight) : null;
    resizeObserver?.observe(element);

    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  // ヘッダー自体が無効の場合は何も表示しない
  if (!HEADER_ENABLED) {
    return null;
  }

  // 表示/非表示のクラスを決定
  const visibilityClass = (() => {
    if (!visibility.sp && !visibility.pc) return "hidden";
    if (!visibility.sp && visibility.pc) return "hidden sm:block";
    if (visibility.sp && !visibility.pc) return "block sm:hidden";
    return "";
  })();

  return (
    <header
      id={APP_HEADER_ELEMENT_ID}
      ref={headerRef}
      className={`fixed shadow inset-x-0 top-0 header-layer border-b border-border bg-card text-card-foreground ${visibilityClass}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-2 sm:py-4">
        <Brand />
        {menuEnabled.sp && navVisibility.sp && (
          <SpNavSwitch isMenuOpen={isMenuOpen} onToggle={handleToggle} />
        )}
        {menuEnabled.pc && navVisibility.pc && <PcNavigation items={navItems} />}
      </div>

      {menuEnabled.sp && navVisibility.sp && (
        <SpNavigation
          isOpen={isMenuOpen}
          items={navItems}
          onClose={handleClose}
          headerOffset={headerOffset}
        />
      )}
    </header>
  );
};
