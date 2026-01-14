"use client";

import { APP_HEADER_ELEMENT_ID } from "@/components/AppFrames/constants";
import { Button } from "@/components/Form/Button/Button";

import { useHeaderData } from "../../hooks";
import { Brand } from "./Brand";
import { HeaderShell } from "./HeaderShell";
import { PcNavigation } from "@/components/AppFrames/User/Sections/Header/Pc/PcNavigation";
import { SpNavigation } from "@/components/AppFrames/User/Sections/Header/Sp/SpNavigation";
import { SpNavSwitch } from "@/components/AppFrames/User/Sections/Header/Sp/SpNavSwitch";

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

  // SP表示可否
  const showSpNav = navEnabled.sp && navVisibility.sp;
  // PC表示可否
  const showPcNav = navEnabled.pc && navVisibility.pc;

  return (
    <header
      id={APP_HEADER_ELEMENT_ID}
      ref={headerRef}
      className={`fixed shadow inset-x-0 top-0 header-layer border-b border-border bg-header text-header-foreground ${visibilityClass}`}
    >
      <HeaderShell
        left={<Brand />}
        center={showPcNav && <PcNavigation items={navItems} showIcons={showIcons} />}
        right={
          <>
            {/* PC版: ヘッダー右側にCTAボタン */}
            <Button variant="default" size="sm" className="hidden sm:inline-flex">
              お問い合わせ
            </Button>
            {showSpNav && <SpNavSwitch isMenuOpen={isMenuOpen} onToggle={toggleMenu} />}
          </>
        }
      />

      {showSpNav && (
        <SpNavigation
          isOpen={isMenuOpen}
          items={navItems}
          showIcons={showIcons}
          onClose={closeMenu}
          headerOffset={headerOffset}
          footer={
            /* SP版: メニュー下部にCTAボタン */
            <Button variant="default" className="w-full">
              お問い合わせ
            </Button>
          }
        />
      )}
    </header>
  );
};
