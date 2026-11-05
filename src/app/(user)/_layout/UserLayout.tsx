"use client";

import { type CSSProperties, type ReactNode, useState } from "react";

import { Flex } from "@/components/Layout/Flex";
import { useHeaderHeight } from "@/hooks/useHeaderHeight";
import UnreadNotificationModal from "@/features/notification/components/common/UnreadNotificationModal";

import { BackgroundLayer } from "./BackgroundLayer";
import { Banner } from "./Banner";
import { UserBottomNav } from "./BottomNav";
import { BottomNavSpacer } from "./BottomNav/BottomNavSpacer";
import { UserFooter } from "./Footer";
import { UserNavigation } from "./Header";
import { useFrameAttributes } from "@/app/_layout/frame/useFrameAttributes";
import { frameTable } from "./extensions/frameTable";
import { BOTTOM_NAV_HEIGHT } from "@/config/ui/user-bottom-menu.config";
import {
  BACKGROUND_IMAGE_URL,
  BACKGROUND_OVERLAY_COLOR,
  BACKGROUND_OVERLAY_OPACITY,
} from "@/config/ui/user-layout.config";

type LayoutStyle = CSSProperties & {
  "--app-header-height"?: string;
  "--app-banner-height"?: string;
  "--app-bottom-nav-height"?: string;
};

/**
 * slot の約束(6 つ共通): 省略(undefined) = 既定の部品 / null = 描かない / 要素 = それを描く。
 * fork は layout.tsx を丸ごと置き換え `UserLayout.replace.tsx` へ向け、そこで既定の UserLayout に slot を渡す。
 * 経緯と手順: ./README.md
 */
export type UserLayoutProps = {
  readonly children: ReactNode;
  /**
   * ヘッダーより上に固定で出す帯。既定 = なし(省略と null は同じ)。
   * 実測の高さを --app-banner-height に書き、ヘッダーの top と本文(#stretch-wrapper の前のスペーサー)をその分押し下げる
   */
  readonly banner?: ReactNode;
  /** ヘッダー。既定 = ./Header の UserNavigation */
  readonly header?: ReactNode;
  /** フッター。既定 = ./Footer の UserFooter */
  readonly footer?: ReactNode;
  /** ボトムナビ(高さ分のスペーサーを含む)。既定 = BottomNavSpacer + UserBottomNav */
  readonly bottomNav?: ReactNode;
  /** 最背面の背景。既定 = BackgroundLayer(config/ui/user-layout.config の 3 値) */
  readonly background?: ReactNode;
  /** 未読お知らせのモーダル。既定 = UnreadNotificationModal */
  readonly notificationModal?: ReactNode;
};

/** ユーザー側の枠の既定の組み立て。src/app/(user)/layout.tsx が 1 行スイッチで default に束ねる */
export function UserLayout({
  children,
  banner,
  header,
  footer,
  bottomNav,
  background,
  notificationModal,
}: UserLayoutProps) {
  const frame = useFrameAttributes(frameTable);
  const headerHeight = useHeaderHeight();
  const [bannerHeight, setBannerHeight] = useState(0);
  const hasBanner = banner !== undefined && banner !== null;
  // ボトムナビの高さは config の値 + 下の safe-area(ナビが実際に覆う高さ。固定要素・スペーサー・トーストがこれだけ避ける)。
  // bottomNav={null} の時は書かない(:root の 0px)。
  // 隠している間(各ルートの枠の宣言 frame.default.ts / frame.ts)の 0 は styles/core/frame.css が作る
  const hasBottomNav = bottomNav !== null;

  const layoutStyle: LayoutStyle = {
    "--app-header-height": `${headerHeight}px`,
    ...(hasBottomNav ? { "--app-bottom-nav-height": `calc(${BOTTOM_NAV_HEIGHT}px + var(--app-safe-area-bottom))` } : {}),
    ...(hasBanner ? { "--app-banner-height": `${bannerHeight}px` } : {}),
  };

  return (
    <>
      {background === undefined ? (
        <BackgroundLayer
          imageUrl={BACKGROUND_IMAGE_URL || undefined}
          overlayColor={BACKGROUND_OVERLAY_COLOR}
          overlayOpacity={BACKGROUND_OVERLAY_OPACITY}
        />
      ) : (
        background
      )}
      {/* data-frame-root + 今のルートの宣言(各ルートの枠の宣言 → 表 → useFrameAttributes)の属性:
          data-frame-hide の部位を隠し、data-frame-fill の間は確定高さ + overflow-clip に切り替わる
          (既定は min-h で伸びる通常ページ)。規則は styles/core/frame.css */}
      <Flex
        id="user-app-container"
        data-user-app-container=""
        data-slot="app-container"
        data-frame-root=""
        {...frame}
        direction="column"
        className="my-0 min-h-[var(--viewport-height,100dvh)] text-foreground"
        style={layoutStyle}
      >
        {hasBanner && <Banner onHeightChange={setBannerHeight}>{banner}</Banner>}
        {header === undefined ? <UserNavigation /> : header}
        {/* banner の高さ分だけ本文を押し下げる(ヘッダーの分は #stretch-wrapper の padding-top) */}
        {hasBanner && <div aria-hidden="true" className="shrink-0 h-[var(--app-banner-height,0px)]" />}
        <div
          id="stretch-wrapper"
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
        {notificationModal === undefined ? <UnreadNotificationModal /> : notificationModal}
      </Flex>
    </>
  );
}
