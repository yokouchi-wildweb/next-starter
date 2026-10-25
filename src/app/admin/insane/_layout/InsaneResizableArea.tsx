// src/app/admin/insane/_layout/InsaneResizableArea.tsx

"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { InsanePcSidebar } from "./InsanePcSidebar";
import { InsaneSpSidebar } from "./InsaneSpSidebar";

export function InsaneResizableArea({
  children,
  isSidebarOpen = false,
  onSidebarClose,
  sidebar,
  footer,
}: {
  children: ReactNode;
  isSidebarOpen?: boolean;
  onSidebarClose?: () => void;
  /** サイドバーの中身(InsaneProtectedLayout の sidebar slot)。省略 = InsaneSidebar / null = サイドバーとリサイズのつまみを描かない */
  sidebar?: ReactNode;
  /** スクロール領域の末尾(InsaneProtectedLayout の footer slot)。省略 = 無し(今の insane はフッターを持たない) / 要素 = それ */
  footer?: ReactNode;
}) {
  const hasSidebar = sidebar !== null;
  const [sidebarWidth, setSidebarWidth] = useState(192);
  const dragging = useRef(false);
  const isSidebarResizable = APP_FEATURES.adminConsole.enableSidebarResizing;

  useEffect(() => {
    if (!isSidebarResizable || !hasSidebar) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.min(Math.max(180, e.clientX), 600);
      setSidebarWidth(newWidth);
    };
    const stopDragging = () => {
      dragging.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, [isSidebarResizable, hasSidebar]);

  return (
    <div className="flex flex-1 min-h-0 relative">
      {hasSidebar ? (
        <>
          <InsaneSpSidebar width={sidebarWidth} isOpen={isSidebarOpen} onClose={onSidebarClose} content={sidebar} />
          <InsanePcSidebar width={sidebarWidth} content={sidebar} />
        </>
      ) : null}

      {hasSidebar && isSidebarResizable ? (
        <div
          onMouseDown={() => {
            dragging.current = true;
            document.body.style.cursor = "ew-resize";
          }}
          className="hidden md:block w-1 cursor-ew-resize bg-border hover:bg-muted shrink-0"
        />
      ) : null}

      {/* メイン領域: 縦スクロールはここで担う。AdminLayout 側は overflow-hidden に変更されたため、
          insane 配下でコンテンツが画面高を超える場合のスクロール責務はこのコンテナが持つ。 */}
      <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden">
        {children}
        {footer}
      </div>
    </div>
  );
}
