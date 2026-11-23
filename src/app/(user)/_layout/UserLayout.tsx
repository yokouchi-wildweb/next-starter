"use client";

import { type CSSProperties, type ReactNode, Suspense, useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { useHeaderHeight } from "@/app/_layout/useHeaderHeight";
import { FrameParts } from "@/app/_layout/FrameParts";

import { BackgroundLayer } from "./BackgroundLayer";
import { Banner } from "./Banner";
import { DefaultBottomNav } from "./BottomNav/DefaultBottomNav";
import { UserFooter } from "./Footer";
import { UserNavigation } from "./Header";
import { FramePart } from "@/app/_layout/frame/FramePart";
import { frameTable } from "./extensions/frameTable";
import { userOverlays } from "./extensions/userOverlays";
import { userLayoutConfig } from "./config";

type LayoutStyle = CSSProperties & {
  "--app-header-height"?: string;
  "--app-banner-height"?: string;
  "--app-bottom-nav-height"?: string;
  "--app-bottom-nav-height-value"?: string;
};

/**
 * slot の約束(5 つ共通): 省略(undefined) = 既定の部品 / null = 描かない / 要素 = それを描く。
 * fork は layout.tsx を丸ごと置き換え `UserLayout.replace.tsx` へ向け、そこで既定の UserLayout に slot を渡す。
 * 経緯と手順: ./README.md
 */
export type UserLayoutProps = {
  readonly children: ReactNode;
  /**
   * ヘッダーより上に固定で出す帯。既定 = なし(省略と null は同じ)。
   * 実測の高さを --app-banner-height に書き、ヘッダーの top と本文(本文の包みの前のスペーサー)をその分押し下げる
   */
  readonly banner?: ReactNode;
  /** ヘッダー。既定 = ./Header の UserNavigation */
  readonly header?: ReactNode;
  /** フッター。既定 = ./Footer の UserFooter */
  readonly footer?: ReactNode;
  /** ボトムナビ(高さ分のスペーサーを含む)。既定 = ./BottomNav の DefaultBottomNav(BottomNavSpacer + UserBottomNav。項目が空なら描かず、--app-bottom-nav-height も 0 のまま) */
  readonly bottomNav?: ReactNode;
  /** 最背面の背景。既定 = BackgroundLayer(枠の設定 layout.background の 3 値、./config.ts) */
  readonly background?: ReactNode;
};

/**
 * ユーザー側の枠の既定の組み立て。src/app/(user)/layout.tsx が 1 行スイッチで default に束ねる。
 * 枠の根はセッションも URL も読まない(殻 = build で焼く最初の HTML に入る)。隠しうる差し込み口(ヘッダー・フッター・ボトムナビ)と
 * 本文の包みは FramePart が包み、今のルートの宣言(隠す・fill)を部位ごとに自分の印にする(部位と判定が同じ塊で届く)。
 * ログインで変わる部分(ヘッダーのメニュー・ボトムナビの項目)は各部位の中の Suspense の内側で読む
 */
export function UserLayout({
  children,
  banner,
  header,
  footer,
  bottomNav,
  background,
}: UserLayoutProps) {
  const headerHeight = useHeaderHeight();
  const [bannerHeight, setBannerHeight] = useState(0);
  const hasBanner = banner !== undefined && banner !== null;
  // ボトムナビの高さは config の値 + 下の safe-area(ナビが実際に覆う高さ。固定要素・スペーサー・トーストがこれだけ避ける)。
  // 要素を渡した時はその要素の物として書く。bottomNav={null} の時は書かない(:root の 0px)。
  // 既定のボトムナビ(slot 省略)は項目がセッションで変わるので、値だけを --app-bottom-nav-height-value に置き、
  // 描かれた時(外枠の中に data-slot="bottom-nav" がある時)に styles/core/frame.css が --app-bottom-nav-height へ移す。
  // 隠している間(各ルートの枠の宣言 frame.ts / frame.override.ts)の 0 も styles/core/frame.css が作る
  const bottomNavHeight = `calc(${userLayoutConfig.bottomMenu.height}px + var(--app-safe-area-bottom))`;

  // ヘッダーの高さは測れた時だけ書く(null = 測る前。最初の HTML とページを移る間は styles/core/frame.css の初期値 = 今の行の高さが効き、
  // 本文がヘッダーに重ならない)。測った値は初期値を上書きするだけ(隠している間の 0 も書く)
  const layoutStyle: LayoutStyle = {
    ...(headerHeight === null ? {} : { "--app-header-height": `${headerHeight}px` }),
    ...(bottomNav === undefined ? { "--app-bottom-nav-height-value": bottomNavHeight } : {}),
    ...(bottomNav !== undefined && bottomNav !== null ? { "--app-bottom-nav-height": bottomNavHeight } : {}),
    ...(hasBanner ? { "--app-banner-height": `${bannerHeight}px` } : {}),
  };

  return (
    <>
      {/* fork の slot(background・banner の中身)は部位の包みの外なので、ここで Suspense の内側へ(読んでも枠を止めない) */}
      {background === undefined ? (
        <BackgroundLayer
          imageUrl={userLayoutConfig.layout.background.imageUrl || undefined}
          overlayColor={userLayoutConfig.layout.background.overlayColor}
          overlayOpacity={userLayoutConfig.layout.background.overlayOpacity}
        />
      ) : (
        <Suspense fallback={null}>{background}</Suspense>
      )}
      {/* data-frame-root = 外枠。今のルートの宣言(各ルートの枠の宣言 → 表)は部位ごとの FramePart の印(data-frame-hide・data-frame-fill)で、
          styles/core/frame.css が部位を隠し、fill の間は外枠を確定高さ + overflow-clip に切り替える(:has()。既定は min-h で伸びる通常ページ) */}
      <Flex
        data-slot="app-container"
        data-frame-root=""
        direction="column"
        className="my-0 min-h-[var(--viewport-height,100dvh)] text-foreground"
        style={layoutStyle}
      >
        {hasBanner && (
          <Banner onHeightChange={setBannerHeight}>
            <Suspense fallback={null}>{banner}</Suspense>
          </Banner>
        )}
        {header !== null && <FramePart table={frameTable}>{header === undefined ? <UserNavigation /> : header}</FramePart>}
        {/* banner の高さ分だけ本文を押し下げる(ヘッダーの分は下の本文の包みの padding-top) */}
        {hasBanner && <Block aria-hidden="true" className="shrink-0 h-[var(--app-banner-height,0px)]" />}
        <FramePart table={frameTable}>
          <Flex
            direction="column"
            className="flex-1 min-h-0 pt-[var(--app-header-height,0px)] pl-[var(--app-safe-area-left)] pr-[var(--app-safe-area-right)]"
          >
            {children}
          </Flex>
        </FramePart>
        {footer !== null && <FramePart table={frameTable}>{footer === undefined ? <UserFooter /> : footer}</FramePart>}
        {/* 既定のボトムナビは項目が空ならスペーサーごと描かない */}
        {bottomNav !== null && <FramePart table={frameTable}>{bottomNav === undefined ? <DefaultBottomNav /> : bottomNav}</FramePart>}
        {/* 枠に重ねる部品(点 userOverlays、slot ではない)。上流は messaging の未読のお知らせのモーダル
            (門 messagingInbox が閉・showUnreadModal が切なら何も描かず取りに行かない。messaging が閉じれば門番が外す) */}
        <FrameParts items={userOverlays} />
      </Flex>
    </>
  );
}
