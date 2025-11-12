"use client";

import { type CSSProperties, type ReactNode, useMemo } from "react";

import { Main } from "@/components/Layout/Main";
import { useFooterHeight, useHeaderHeight } from "@/hooks/useLayoutElementHeight";

import { AdminFooter } from "./AdminFooter";
import { AdminHeader } from "./AdminHeader";

export type AdminLayoutClientProps = {
  children: ReactNode;
  headerLogoUrl?: string;
  headerLogoDarkUrl?: string;
  footerText?: string | null;
};

type AdminLayoutCSSVariables = CSSProperties & {
  "--app-header-height"?: string;
  "--app-footer-height"?: string;
  "--app-viewport-height"?: string;
};

const mainBaseStyle: CSSProperties = {
  minHeight:
    "max(0px, calc(var(--app-viewport-height, 100dvh) - var(--app-header-height, 0px) - var(--app-footer-height, 0px)))",
};

export function AdminLayoutClient({
  children,
  headerLogoUrl,
  headerLogoDarkUrl,
  footerText,
}: AdminLayoutClientProps) {
  const headerHeight = useHeaderHeight();
  const footerHeight = useFooterHeight();

  const layoutStyle: AdminLayoutCSSVariables = useMemo(
    () => ({
      "--app-header-height": `${headerHeight}px`,
      "--app-footer-height": `${footerHeight}px`,
      "--app-viewport-height": "100dvh",
    }),
    [footerHeight, headerHeight],
  );

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col bg-background text-foreground"
      style={layoutStyle}
    >
      <AdminHeader logoUrl={headerLogoUrl} darkLogoUrl={headerLogoDarkUrl} />
      <Main variant="plain" className="flex flex-1 min-h-0 flex-col" style={mainBaseStyle}>
        {children}
      </Main>
      <AdminFooter text={footerText} />
    </div>
  );
}
