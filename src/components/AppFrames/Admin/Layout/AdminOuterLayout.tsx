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
      {/* ヘッダー固定 + メイン領域は配下が独自にスクロールを担う土台。
          ここは scroll container 化させてはならないため overflow-clip を使う。
          overflow-hidden は視覚クリップは効くが scroll container として残るため、sr-only な
          checkbox（SwitchInput など）に focus が移った際のブラウザ自動 scrollIntoView で
          ここの scrollTop が動いてしまい、フォーム全体が画面外へ押し出される崩れが起きる。
          overflow-clip は CSS 仕様上 scroll container を作らないため focus 駆動の
          スクロールも発火しない。配下（ResizableArea / InsaneResizableArea / login・setup の
          Main）が自前でスクロール可能領域を確保する前提。 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-clip">{children}</div>
    </div>
  );
}
