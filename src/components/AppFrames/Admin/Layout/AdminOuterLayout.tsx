// src/components/Admin/Layout/AdminOuterLayout.tsx

"use client";

import { type CSSProperties, type ReactNode, useMemo } from "react";

import { useHeaderHeight } from "@/hooks/useHeaderHeight";
import { cn } from "@/lib/cn";
import { useAdminLayoutStore } from "@/stores/adminLayout";

import { Header } from "../Sections/Header";

export type AdminLayoutClientProps = {
  children: ReactNode;
  /** 追加のクラス名（invert等のスタイル制御用） */
  className?: string;
};

type AdminLayoutCSSVariables = CSSProperties & {
  "--app-header-height"?: string;
};

export function AdminOuterLayout({
  children,
  className,
}: AdminLayoutClientProps) {
  const headerHeight = useHeaderHeight();
  const { extraClassName } = useAdminLayoutStore();

  const layoutStyle: AdminLayoutCSSVariables = useMemo(
    () => ({
      "--app-header-height": `${headerHeight}px`,
    }),
    [headerHeight],
  );

  return (
    <div
      className={cn(
        "relative flex h-[var(--viewport-height,100dvh)] flex-col overflow-hidden bg-background text-foreground",
        className,
        extraClassName,
      )}
      style={layoutStyle}
    >
      <Header />
      {/* ヘッダー固定 + メイン領域だけスクロール可能にする土台。
          保護下ではこの中で AdminProtectedLayout が h-full を取り、内部で独自スクロールするため
          ここの overflow-y-auto は事実上 login/setup などフォールバック用 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
