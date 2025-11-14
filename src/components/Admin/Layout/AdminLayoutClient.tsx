"use client";

import { type CSSProperties, type ReactNode, useMemo } from "react";

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
};

export function AdminLayoutClient({
  children,
  headerLogoUrl,
  headerLogoDarkUrl,
  footerText,
}: AdminLayoutClientProps) {
  const headerHeight = useHeaderHeight();

  const layoutStyle: AdminLayoutCSSVariables = useMemo(
    () => ({
      "--app-header-height": `${headerHeight}px`,
    }),
    [headerHeight],
  );

  return (
    <div
      className="relative flex min-h-[var(--viewport-height,100dvh)] flex-col bg-background text-foreground"
      style={layoutStyle}
    >
      <AdminHeader logoUrl={headerLogoUrl} darkLogoUrl={headerLogoDarkUrl} />
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      <AdminFooter text={footerText} />
    </div>
  );
}
