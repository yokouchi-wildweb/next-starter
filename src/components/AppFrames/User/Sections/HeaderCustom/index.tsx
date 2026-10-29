"use client";

import { APP_HEADER_ELEMENT_ID } from "@/components/AppFrames/constants";
import { Button } from "@/components/Form/Button/Button";

import { useHeaderData } from "@/app/(user)/_layout/hooks";
import { Brand } from "./Brand";
import { HeaderShell } from "./HeaderShell";
import { PcNavigation } from "./Pc/PcNavigation";
import { SpNavigation } from "./Sp/SpNavigation";
import { SpNavSwitch } from "./Sp/SpNavSwitch";

export const UserNavigation = () => {
  const {
    enabled,
    navItems,
    navEnabled,
    showIcons,
    isMenuOpen,
    closeMenu,
    toggleMenu,
    headerRef,
    headerOffset,
  } = useHeaderData();

  // ヘッダー自体が無効の場合は何も表示しない
  if (!enabled) {
    return null;
  }

  // ナビの可否は config(HEADER_NAV_ENABLED)。ページ単位で隠すのは Hide* の印の CSS(ナビの部品の data-frame-part="header-nav")
  const showSpNav = navEnabled.sp;
  const showPcNav = navEnabled.pc;

  return (
    <header
      id={APP_HEADER_ELEMENT_ID}
      data-frame-part="header"
      ref={headerRef}
      className="fixed shadow inset-x-0 top-0 header-layer border-b border-border bg-header text-header-foreground"
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
