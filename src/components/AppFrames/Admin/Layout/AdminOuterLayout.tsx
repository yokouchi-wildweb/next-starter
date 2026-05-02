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
          かつてここを overflow-y-auto にしていたが、AdminProtectedLayout / InsaneProtectedLayout
          配下にもう一段 overflow-y-auto があるため二重スクロールとなり、フォーム再 render 時の
          フォーカス自動スクロールで外側がジャンプしレイアウトが崩れる問題が発生していた。
          配下のレイアウト（ResizableArea / InsaneResizableArea / login・setup の Main）が
          自前でスクロール可能領域を確保する前提とする。 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}
