"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/Button/Button";
import { Section } from "@/components/Layout/Section";
import { FrameParts } from "@/app/_layout/FrameParts";

import { userHeaderActions } from "../extensions/userHeaderActions";
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
  /** ブランドの前(header-left の先頭)。例: 戻るボタン。既定 = なし */
  readonly leading?: ReactNode;
  /**
   * ヘッダー右(SP メニューの開閉ボタンの前)。既定 = 点 userHeaderActions の部品(各ドメインが差す、閉じたドメインの部品は消える)+ PC だけに出る「お問い合わせ」。
   * 要素はそのまま描く = SP のヘッダーにも出る(PC だけにするなら要素側で `hidden sm:flex` 等)
   */
  readonly actions?: ReactNode;
  /** SP メニューのパネル下部。既定 = 幅いっぱいの「お問い合わせ」。null でパネル下部の領域ごと描かない */
  readonly menuActions?: ReactNode;
};

export const UserNavigation = ({ leading, actions, menuActions }: UserNavigationProps = {}) => {
  const {
    navItems,
    showIcons,
    isMenuOpen,
    closeMenu,
    toggleMenu,
    headerRef,
    headerOffset,
  } = useHeaderData();

  // ヘッダーとナビを隠す端末・ページ(各ルートの枠の宣言 frame.ts / frame.override.ts)では styles/core/frame.css が display: none にする。
  // 項目が空(例: ログイン中の項目を [] にした fork)なら、ナビの部品(PC のナビ・SP の開閉ボタンとパネル)を描かない
  const hasNav = navItems.length > 0;
  return (
    <Section
      as="header"
      data-slot="header"
      ref={headerRef}
      className="fixed shadow inset-x-0 top-[var(--app-banner-height,0px)] header-layer border-b border-border bg-header text-header-foreground pt-[max(0px,calc(var(--app-safe-area-top)_-_var(--app-banner-height,0px)))] pl-[var(--app-safe-area-left)] pr-[var(--app-safe-area-right)]"
    >
      <HeaderShell
        left={
          <>
            {leading}
            <Brand />
          </>
        }
        center={hasNav ? <PcNavigation items={navItems} showIcons={showIcons} /> : undefined}
        right={
          <>
            {actions === undefined ? (
              <>
                {/* 点 userHeaderActions の部品(上流の項目は 0) */}
                <FrameParts items={userHeaderActions} />
                {/* PC版: ヘッダー右側にCTAボタン */}
                <Button variant="default" size="sm" className="hidden sm:inline-flex">
                  お問い合わせ
                </Button>
              </>
            ) : (
              actions
            )}
            {hasNav && <SpNavSwitch isMenuOpen={isMenuOpen} onToggle={toggleMenu} />}
          </>
        }
      />

      {hasNav && (
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
    </Section>
  );
};
