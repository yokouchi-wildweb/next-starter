"use client";

import { type CSSProperties, type ReactNode, useState } from "react";

import { Flex } from "@/components/Layout/Flex";
import { useHeaderHeight } from "@/hooks/useHeaderHeight";
import { InboxUnreadModal } from "@/features/core/messaging/components/InboxUnreadModal";

import { BackgroundLayer } from "./BackgroundLayer";
import { Banner } from "./Banner";
import { UserBottomNav } from "./BottomNav";
import { BottomNavSpacer } from "./BottomNav/BottomNavSpacer";
import { UserFooter } from "./Footer";
import { UserNavigation } from "./Header";
import { useFrameAttributes } from "@/app/_layout/frame/useFrameAttributes";
import { frameTable } from "./extensions/frameTable";
import { userLayoutConfig } from "./config";

type LayoutStyle = CSSProperties & {
  "--app-header-height"?: string;
  "--app-banner-height"?: string;
  "--app-bottom-nav-height"?: string;
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
  /** ボトムナビ(高さ分のスペーサーを含む)。既定 = BottomNavSpacer + UserBottomNav */
  readonly bottomNav?: ReactNode;
  /** 最背面の背景。既定 = BackgroundLayer(枠の設定 layout.background の 3 値、./config.ts) */
  readonly background?: ReactNode;
};

/** ユーザー側の枠の既定の組み立て。src/app/(user)/layout.tsx が 1 行スイッチで default に束ねる */
export function UserLayout({
  children,
  banner,
  header,
  footer,
  bottomNav,
  background,
}: UserLayoutProps) {
  const frame = useFrameAttributes(frameTable);
  const headerHeight = useHeaderHeight();
  const [bannerHeight, setBannerHeight] = useState(0);
  const hasBanner = banner !== undefined && banner !== null;
  // ボトムナビの高さは config の値 + 下の safe-area(ナビが実際に覆う高さ。固定要素・スペーサー・トーストがこれだけ避ける)。
  // bottomNav={null} の時は書かない(:root の 0px)。
  // 隠している間(各ルートの枠の宣言 frame.ts / frame.override.ts)の 0 は styles/core/frame.css が作る
  const hasBottomNav = bottomNav !== null;

  // ヘッダーの高さは測れた時だけ書く(null = 測る前。最初の HTML とページを移る間は styles/core/frame.css の初期値 = 今の行の高さが効き、
  // 本文がヘッダーに重ならない)。測った値は初期値を上書きするだけ(隠している間の 0 も書く)
  const layoutStyle: LayoutStyle = {
    ...(headerHeight === null ? {} : { "--app-header-height": `${headerHeight}px` }),
    ...(hasBottomNav ? { "--app-bottom-nav-height": `calc(${userLayoutConfig.bottomMenu.height}px + var(--app-safe-area-bottom))` } : {}),
    ...(hasBanner ? { "--app-banner-height": `${bannerHeight}px` } : {}),
  };

  return (
    <>
      {background === undefined ? (
        <BackgroundLayer
          imageUrl={userLayoutConfig.layout.background.imageUrl || undefined}
          overlayColor={userLayoutConfig.layout.background.overlayColor}
          overlayOpacity={userLayoutConfig.layout.background.overlayOpacity}
        />
      ) : (
        background
      )}
      {/* data-frame-root + 今のルートの宣言(各ルートの枠の宣言 → 表 → useFrameAttributes)の属性:
          data-frame-hide の部位を隠し、data-frame-fill の間は確定高さ + overflow-clip に切り替わる
          (既定は min-h で伸びる通常ページ)。規則は styles/core/frame.css */}
      <Flex
        data-slot="app-container"
        data-frame-root=""
        {...frame}
        direction="column"
        className="my-0 min-h-[var(--viewport-height,100dvh)] text-foreground"
        style={layoutStyle}
      >
        {hasBanner && <Banner onHeightChange={setBannerHeight}>{banner}</Banner>}
        {header === undefined ? <UserNavigation /> : header}
        {/* banner の高さ分だけ本文を押し下げる(ヘッダーの分は下の本文の包みの padding-top) */}
        {hasBanner && <div aria-hidden="true" className="shrink-0 h-[var(--app-banner-height,0px)]" />}
        <div
          className="flex flex-1 min-h-0 flex-col pt-[var(--app-header-height,0px)] pl-[var(--app-safe-area-left)] pr-[var(--app-safe-area-right)]"
        >
          {children}
        </div>
        {footer === undefined ? <UserFooter /> : footer}
        {bottomNav === undefined ? (
          <>
            <BottomNavSpacer />
            <UserBottomNav />
          </>
        ) : (
          bottomNav
        )}
        {/* 未読のお知らせのモーダル(slot ではない)。出すかは messagingConfig.inbox.showUnreadModal(既定 切)、
            出す住所は inbox.unreadModalPaths。門は見ない(受け取り箱の API は常に開)。自前のモーダルは UserLayout.replace で */}
        <InboxUnreadModal />
      </Flex>
    </>
  );
}
