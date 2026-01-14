"use client";

import { PcNavigation } from "./PcNavigation";
import { SpNavigation } from "./SpNavigation";
import { Brand } from "./Brand";
import { SpNavSwitch } from "./SpNavSwitch";
import { APP_HEADER_ELEMENT_ID } from "@/components/AppFrames/constants";
import { useHeaderData } from "../../hooks";

export const UserNavigation = () => {
  const {
    enabled,
    navItems,
    navEnabled,
    navVisibility,
    showIcons,
    isMenuOpen,
    closeMenu,
    toggleMenu,
    headerRef,
    headerOffset,
    visibilityClass,
  } = useHeaderData();

  // ヘッダー自体が無効の場合は何も表示しない
  if (!enabled) {
    return null;
  }

  return (
    <header
      id={APP_HEADER_ELEMENT_ID}
      ref={headerRef}
      className={`fixed shadow inset-x-0 top-0 header-layer border-b border-border bg-header text-header-foreground ${visibilityClass}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-stretch justify-between px-4 py-2 sm:py-4">
        <Brand />
        {navEnabled.sp && navVisibility.sp && (
          <SpNavSwitch isMenuOpen={isMenuOpen} onToggle={toggleMenu} />
        )}
        {navEnabled.pc && navVisibility.pc && <PcNavigation items={navItems} showIcons={showIcons} />}
      </div>

      {navEnabled.sp && navVisibility.sp && (
        <SpNavigation
          isOpen={isMenuOpen}
          items={navItems}
          showIcons={showIcons}
          onClose={closeMenu}
          headerOffset={headerOffset}
        />
      )}
    </header>
  );
};
