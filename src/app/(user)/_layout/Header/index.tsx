"use client";

import type { ReactNode } from "react";

import { APP_HEADER_ELEMENT_ID } from "@/components/AppFrames/constants";
import { Button } from "@/components/Form/Button/Button";

import { useHeaderData } from "../hooks";
import { Brand } from "./Brand";
import { HeaderShell } from "./HeaderShell";
import { PcNavigation } from "./Pc/PcNavigation";
import { SpNavigation } from "./Sp/SpNavigation";
import { SpNavSwitch } from "./Sp/SpNavSwitch";

/**
 * slot の約束(3 つ共通、UserLayout の slot と同じ): 省略(undefined) = 既定 / null = 描かない / 要素 = それを描く。
 * fork は UserLayout の header slot に `<UserNavigation leading={…} actions={…} menuActions={…} />` を渡す。手順: ../README.md
 */
export type UserNavigationProps = {
  /** ブランドの前(#header-left の先頭)。例: 戻るボタン。既定 = なし */
  readonly leading?: ReactNode;
  /**
   * ヘッダー右(SP メニューの開閉ボタンの前)。既定 = PC だけに出る「お問い合わせ」。
   * 要素はそのまま描く = SP のヘッダーにも出る(PC だけにするなら要素側で `hidden sm:flex` 等)
   */
  readonly actions?: ReactNode;
  /** SP メニューのパネル下部。既定 = 幅いっぱいの「お問い合わせ」。null でパネル下部の領域ごと描かない */
  readonly menuActions?: ReactNode;
};

export const UserNavigation = ({ leading, actions, menuActions }: UserNavigationProps = {}) => {
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
      data-frame-part="header"
      ref={headerRef}
      className={`fixed shadow inset-x-0 top-[var(--app-banner-height,0px)] header-layer border-b border-border bg-header text-header-foreground ${visibilityClass}`}
    >
      <HeaderShell
        left={
          <>
            {leading}
            <Brand />
          </>
        }
        center={showPcNav && <PcNavigation items={navItems} showIcons={showIcons} />}
        right={
          <>
            {actions === undefined ? (
              /* PC版: ヘッダー右側にCTAボタン */
              <Button variant="default" size="sm" className="hidden sm:inline-flex">
                お問い合わせ
              </Button>
            ) : (
              actions
            )}
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
            menuActions === undefined ? (
              /* SP版: メニュー下部にCTAボタン */
              <Button variant="default" className="w-full">
                お問い合わせ
              </Button>
            ) : (
              menuActions
            )
          }
        />
      )}
    </header>
  );
};
