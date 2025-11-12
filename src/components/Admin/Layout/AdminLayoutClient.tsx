"use client";

import { type CSSProperties, type ReactNode, useMemo } from "react";

import { APP_FOOTER_ELEMENT_ID } from "@/constants/layout";
import { useElementHeight } from "@/hooks/useElementHeight";
import { useHeaderHeight } from "@/hooks/useHeaderHeight";

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
  "--app-content-min-height"?: string;
};

export function AdminLayoutClient({
  children,
  headerLogoUrl,
  headerLogoDarkUrl,
  footerText,
}: AdminLayoutClientProps) {
  const headerHeight = useHeaderHeight();
  const footerHeight = useElementHeight(APP_FOOTER_ELEMENT_ID);

  const layoutStyle: AdminLayoutCSSVariables = useMemo(
    () => ({
      "--app-header-height": `${headerHeight}px`,
      "--app-footer-height": `${footerHeight}px`,
      "--app-content-min-height": "max(0px, calc(100vh - var(--app-header-height, 0px) - var(--app-footer-height, 0px)))",
    }),
    [headerHeight, footerHeight],
  );

  return (
    <div
      className="relative flex min-h-screen flex-col bg-background text-foreground"
      style={layoutStyle}
    >
      <AdminHeader logoUrl={headerLogoUrl} darkLogoUrl={headerLogoDarkUrl} />
      <div
        className="flex flex-1 min-h-0 flex-col"
        style={{ minHeight: "var(--app-content-min-height)" }}
      >
        <div className="flex flex-1 min-h-0 flex-col">{children}</div>
      </div>
      <AdminFooter text={footerText} />
    </div>
  );
}
