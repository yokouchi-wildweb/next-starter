"use client";

import { type CSSProperties, type ReactNode, useState } from "react";

import { Flex } from "@/components/Layout/Flex";
import { useHeaderHeight } from "@/hooks/useHeaderHeight";
import UnreadNotificationModal from "@/features/notification/components/common/UnreadNotificationModal";

import { BottomNavVisibilityProvider } from "@/components/AppFrames/User/contexts/BottomNavVisibilityContext";
import { BackgroundLayer } from "./BackgroundLayer";
import { Banner } from "./Banner";
import { FooterVisibilityProvider } from "@/components/AppFrames/User/contexts/FooterVisibilityContext";
import { HeaderVisibilityProvider } from "@/components/AppFrames/User/contexts/HeaderVisibilityContext";
import { HeaderNavVisibilityProvider } from "@/components/AppFrames/User/contexts/HeaderNavVisibilityContext";
import { UserBottomNav } from "./BottomNav";
import { BottomNavSpacer } from "./BottomNav/BottomNavSpacer";
// header / footer の既定は config の旧切替の経路を通す(upstream では既定部品の re-export。旧入口撤去の区切りで直接 import へ)
import { UserFooter } from "@/config/ui/user-footer.config";
import { UserNavigation } from "@/config/ui/user-header.config";
import { BOTTOM_NAV_ENABLED, BOTTOM_NAV_HEIGHT } from "@/config/ui/user-bottom-menu.config";
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
 * fork は layout.tsx をドット区切り名のカスタム(例 `UserLayout.<project>.tsx`)へ向け、そこで既定の UserLayout に slot を渡す。
 * 経緯と手順: ./README.md
 */
export type UserLayoutProps = {
  readonly children: ReactNode;
  /**
   * ヘッダーより上に固定で出す帯。既定 = なし(省略と null は同じ)。
   * 実測の高さを --app-banner-height に書き、ヘッダーの top と本文(#stretch-wrapper の前のスペーサー)をその分押し下げる
   */
  readonly banner?: ReactNode;
  /** ヘッダー。既定 = config/ui/user-header.config の UserNavigation(旧切替の経路。upstream では既定 Header) */
  readonly header?: ReactNode;
  /** フッター。既定 = config/ui/user-footer.config の UserFooter(旧切替の経路。upstream では既定 Footer) */
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
  const headerHeight = useHeaderHeight();
  const [bannerHeight, setBannerHeight] = useState(0);
  const hasBanner = banner !== undefined && banner !== null;
  // ボトムナビの高さは config の値。既定のボトムナビが無効な時と bottomNav={null} の時は書かない(:root の 0px)。
  // Hide* で隠した時の 0 はまだ扱わない(styles/config.css のコメント参照)
  const hasBottomNav = bottomNav === undefined ? BOTTOM_NAV_ENABLED : bottomNav !== null;

  const layoutStyle: LayoutStyle = {
    "--app-header-height": `${headerHeight}px`,
    ...(hasBottomNav ? { "--app-bottom-nav-height": `${BOTTOM_NAV_HEIGHT}px` } : {}),
    ...(hasBanner ? { "--app-banner-height": `${bannerHeight}px` } : {}),
  };

  return (
    <HeaderVisibilityProvider>
      <HeaderNavVisibilityProvider>
        <FooterVisibilityProvider>
          <BottomNavVisibilityProvider>
            {background === undefined ? (
              <BackgroundLayer
                imageUrl={BACKGROUND_IMAGE_URL || undefined}
                overlayColor={BACKGROUND_OVERLAY_COLOR}
                overlayOpacity={BACKGROUND_OVERLAY_OPACITY}
              />
            ) : (
              background
            )}
            {/* data-user-app-container: <UserPage fill> が配下にある時だけ
                styles/config.css の :has() ルールで確定高さ + overflow-clip に
                切り替わる（既定は min-h で伸びる通常ページ）。
                data-frame-root: 配下に Hide* の印がある間、styles/frame-controls.generated.css が
                その部位を隠す（controls/frameParts.ts）。 */}
            <Flex
              id="user-app-container"
              data-user-app-container=""
              data-frame-root=""
              direction="column"
              className="my-0 min-h-[var(--viewport-height,100dvh)] text-foreground"
              style={layoutStyle}
            >
              {hasBanner && <Banner onHeightChange={setBannerHeight}>{banner}</Banner>}
              {header === undefined ? <UserNavigation /> : header}
              {/* banner の高さ分だけ本文を押し下げる(ヘッダーの分は #stretch-wrapper の padding-top) */}
              {hasBanner && <div aria-hidden="true" className="shrink-0 h-[var(--app-banner-height,0px)]" />}
              <div id="stretch-wrapper" className="flex flex-1 min-h-0 flex-col pt-[var(--app-header-height,0px)]">
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
          </BottomNavVisibilityProvider>
        </FooterVisibilityProvider>
      </HeaderNavVisibilityProvider>
    </HeaderVisibilityProvider>
  );
}

/** @deprecated 旧 props の互換。背景は config/ui/user-layout.config か background slot へ(旧入口撤去の区切りで削除) */
export type UserAppLayoutProps = {
  readonly children: ReactNode;
  /** 背景画像のURL */
  readonly backgroundImageUrl?: string;
  /** オーバーレイの色（任意のCSS色形式: "#000", "black", "rgb(0,0,0)"など） */
  readonly overlayColor?: string;
  /** オーバーレイの透明度（0-1） */
  readonly overlayOpacity?: number;
};

/**
 * @deprecated 旧 export 名の互換。UserLayout を使う(旧 props は background slot に写す)。旧入口撤去の区切りで削除
 */
export const UserAppLayout = ({
  children,
  backgroundImageUrl,
  overlayColor,
  overlayOpacity,
}: UserAppLayoutProps) => (
  <UserLayout
    background={
      <BackgroundLayer
        imageUrl={backgroundImageUrl}
        overlayColor={overlayColor}
        overlayOpacity={overlayOpacity}
      />
    }
  >
    {children}
  </UserLayout>
);
