"use client";

import { type CSSProperties, type ReactNode } from "react";

import { Flex } from "@/components/Layout/Flex";
import { useHeaderHeight } from "@/hooks/useLayoutElementHeight";

import { UserNavigation } from "./navigation";

type LayoutStyle = CSSProperties & {
  "--app-header-height"?: string;
};

export type UserAppLayoutProps = {
  readonly children: ReactNode;
};

export const UserAppLayout = ({ children }: UserAppLayoutProps) => {
  const headerHeight = useHeaderHeight();

  const layoutStyle: LayoutStyle = {
    "--app-header-height": `${headerHeight}px`,
  };

  return (
    <Flex
      direction="column"
      minHeight="screen"
      className="my-0 bg-background text-foreground"
      style={layoutStyle}
    >
      <UserNavigation />
      <div className="flex-1 pt-[var(--app-header-height,0px)]">{children}</div>
    </Flex>
  );
};
