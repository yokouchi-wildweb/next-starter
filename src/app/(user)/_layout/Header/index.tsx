"use client";

import { type ReactNode, Suspense } from "react";

import { Button } from "@/components/Button/Button";
import { Section } from "@/components/Layout/Section";
import { FrameParts } from "@/app/_layout/FrameParts";

import { userHeaderActions } from "../extensions/userHeaderActions";
import { type HeaderNavItem, useCloseMenuOnNavigate, useHeaderMenu, useHeaderNavItems } from "../hooks";
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
  // 器(ロゴ・右の部品・メニューの開閉)は request を読まない = 枠の殻に入る。
  // メニュー項目はセッションで変わるので、項目を使う 3 か所(PC のナビ・SP の開閉ボタン・SP のパネル)はそれぞれ Suspense の内側で読む
  const { showIcons, isMenuOpen, closeMenu, toggleMenu, headerRef, headerOffset } = useHeaderMenu();

  // ヘッダーとナビを隠す端末・ページ(各ルートの枠の宣言 frame.ts / frame.override.ts)では styles/core/frame.css が display: none にする。
  // 項目が空(例: ログイン中の項目を [] にした fork)なら、ナビの部品(PC のナビ・SP の開閉ボタンとパネル)を描かない
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
        center={<NavItems render={(items) => <PcNavigation items={items} showIcons={showIcons} />} />}
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
            <NavItems render={() => <SpNavSwitch isMenuOpen={isMenuOpen} onToggle={toggleMenu} />} />
          </>
        }
      />

      <NavItems
        render={(items) => (
          <SpNavigation
            isOpen={isMenuOpen}
            items={items}
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
      />
      <Suspense fallback={null}>
        <CloseMenuOnNavigate closeMenu={closeMenu} />
      </Suspense>
    </Section>
  );
};

/** メニュー項目を読んで(セッション)、空でなければ render を描く。Suspense の内側で読む(ヘッダーの器は待たない) */
function NavItems({ render }: Readonly<{ render: (items: HeaderNavItem[]) => ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <NavItemsReader render={render} />
    </Suspense>
  );
}

function NavItemsReader({ render }: Readonly<{ render: (items: HeaderNavItem[]) => ReactNode }>) {
  const items = useHeaderNavItems();
  return items.length > 0 ? render(items) : null;
}

/** 住所が変わったらメニューを閉じる。何も描かない(URL を読むので Suspense の内側) */
function CloseMenuOnNavigate({ closeMenu }: Readonly<{ closeMenu: () => void }>) {
  useCloseMenuOnNavigate(closeMenu);
  return null;
}
