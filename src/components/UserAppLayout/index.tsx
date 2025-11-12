"use client";

import { type CSSProperties, type ReactNode, useMemo } from "react";

import { Flex } from "@/components/Layout/Flex";
import { useHeaderHeight } from "@/hooks/useHeaderHeight";

import { UserFooter } from "./UserFooter";
import { UserNavigation } from "./navigation";

type LayoutStyle = CSSProperties & {
  "--app-header-height"?: string;
};

export type UserAppLayoutProps = {
  readonly children: ReactNode;
  readonly footerText?: string;
};

export const UserAppLayout = ({ children, footerText }: UserAppLayoutProps) => {
  const headerHeight = useHeaderHeight();

  const layoutStyle: LayoutStyle = useMemo(
    () => ({
      "--app-header-height": `${headerHeight}px`,
    }),
    [headerHeight],
  );

  return (
    <Flex
      direction="column"
      className="my-0 min-h-[var(--viewport-height,100dvh)] bg-background text-foreground"
      style={layoutStyle}
    >
      <UserNavigation />
      <div className="flex flex-1 min-h-0 flex-col pt-0 md:pt-[var(--app-header-height,0px)]">
        {children}
      </div>
      <UserFooter text={footerText} />
    </Flex>
  );
};
