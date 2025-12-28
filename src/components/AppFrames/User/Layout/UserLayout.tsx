"use client";

import { type CSSProperties, type ReactNode } from "react";

import { Flex } from "@/components/Layout/Flex";
import { useHeaderHeight } from "@/hooks/useHeaderHeight";

import { BottomNavVisibilityProvider } from "../contexts/BottomNavVisibilityContext";
import { BackgroundLayer } from "./BackgroundLayer";
import { FooterVisibilityProvider } from "../contexts/FooterVisibilityContext";
import { HeaderVisibilityProvider } from "../contexts/HeaderVisibilityContext";
import { HeaderNavVisibilityProvider } from "../contexts/HeaderNavVisibilityContext";
import { UserBottomNav } from "../Sections/BottomNav";
import { BottomNavSpacer } from "../Sections/BottomNav/BottomNavSpacer";
import { UserFooter } from "../Sections/Footer";
import { UserNavigation } from "../Sections/Header";

type LayoutStyle = CSSProperties & {
  "--app-header-height"?: string;
};

export type UserAppLayoutProps = {
  readonly children: ReactNode;
  /** 背景画像のURL */
  readonly backgroundImageUrl?: string;
  /** オーバーレイの色（任意のCSS色形式: "#000", "black", "rgb(0,0,0)"など） */
  readonly overlayColor?: string;
  /** オーバーレイの透明度（0-1） */
  readonly overlayOpacity?: number;
};

export const UserAppLayout = ({
  children,
  backgroundImageUrl,
  overlayColor,
  overlayOpacity,
}: UserAppLayoutProps) => {
  const headerHeight = useHeaderHeight();

  const layoutStyle: LayoutStyle = {
    "--app-header-height": `${headerHeight}px`,
  };

  return (
    <HeaderVisibilityProvider>
      <HeaderNavVisibilityProvider>
        <FooterVisibilityProvider>
          <BottomNavVisibilityProvider>
            <BackgroundLayer
              imageUrl={backgroundImageUrl}
              overlayColor={overlayColor}
              overlayOpacity={overlayOpacity}
            />
            <Flex
              direction="column"
              className="my-0 min-h-[var(--viewport-height,100dvh)] text-foreground"
              style={layoutStyle}
            >
              <UserNavigation />
              <div id="stretch-wrapper" className="flex flex-1 min-h-0 flex-col pt-[var(--app-header-height,0px)]">
                {children}
              </div>
              <UserFooter />
              <BottomNavSpacer />
              <UserBottomNav />
            </Flex>
          </BottomNavVisibilityProvider>
        </FooterVisibilityProvider>
      </HeaderNavVisibilityProvider>
    </HeaderVisibilityProvider>
  );
};
