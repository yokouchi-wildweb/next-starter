// src/components/Admin/Layout/AdminOuterLayout.tsx

"use client";

import { type CSSProperties, type ReactNode, useMemo } from "react";

import { useHeaderHeight } from "@/hooks/useHeaderHeight";
import { cn } from "@/lib/cn";
import { useAdminLayoutStore } from "@/stores/useAdminLayoutStore";

import { Footer } from "../Sections/Footer";
import { Header } from "../Sections/Header";

export type AdminLayoutClientProps = {
  children: ReactNode;
  headerLogoUrl?: string;
  headerLogoDarkUrl?: string;
  /** 追加のクラス名（invert等のスタイル制御用） */
  className?: string;
};

type AdminLayoutCSSVariables = CSSProperties & {
  "--app-header-height"?: string;
};

export function AdminOuterLayout({
  children,
  headerLogoUrl,
  headerLogoDarkUrl,
  className,
}: AdminLayoutClientProps) {
  const headerHeight = useHeaderHeight();
  const extraClassName = useAdminLayoutStore((s) => s.extraClassName);

  const layoutStyle: AdminLayoutCSSVariables = useMemo(
    () => ({
      "--app-header-height": `${headerHeight}px`,
    }),
    [headerHeight],
  );

  return (
    <div
      className={cn(
        "relative flex min-h-[var(--viewport-height,100dvh)] flex-col bg-background text-foreground",
        className,
        extraClassName,
      )}
      style={layoutStyle}
    >
      <Header logoUrl={headerLogoUrl} darkLogoUrl={headerLogoDarkUrl} />
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      <Footer />
    </div>
  );
}
