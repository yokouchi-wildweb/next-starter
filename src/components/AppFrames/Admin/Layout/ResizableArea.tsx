// src/components/Admin/layout/ResizableArea.tsx

"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { Footer } from "../Sections/Footer";
import { PcSidebar } from "../Sections/SIdebar/PcSidebar";
import { SpSidebar } from "../Sections/SIdebar/SpSidebar";

export function ResizableArea({
  children,
  isSidebarOpen = false,
  onSidebarClose,
}: {
  children: ReactNode;
  isSidebarOpen?: boolean;
  onSidebarClose?: () => void;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(192); // default 192px
  const dragging = useRef(false);
  const isSidebarResizable = APP_FEATURES.adminConsole.enableSidebarResizing;

  useEffect(() => {
    if (!isSidebarResizable) {
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
  }, [isSidebarResizable]);

  return (
    <div className="flex h-full min-h-0 relative">
      <SpSidebar width={sidebarWidth} isOpen={isSidebarOpen} onClose={onSidebarClose} />
      <PcSidebar width={sidebarWidth} />

      {isSidebarResizable ? (
        <div
          onMouseDown={() => {
            dragging.current = true;
            document.body.style.cursor = "ew-resize";
          }}
          className="hidden md:block h-full w-1 cursor-ew-resize bg-border hover:bg-muted shrink-0"
        />
      ) : null}

      {/* メイン領域: ここがスクロールコンテナ。children を直接インラインし、
          Footer は mt-auto で最下部へ押し下げる sticky-bottom 構成。
          中間の block wrapper を挟まないことで、<AdminPage fill> の
          flex-1 min-h-0 高さチェーンがページまで伝播し、fill ページは
          内部ペインが独自にスクロールできる（外側は非スクロール）。
          non-fill ページは従来通り: 背の高いコンテンツはここでスクロールし、
          短いコンテンツは Footer の mt-auto が最下部へ押し下げる。 */}
      <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden">
        {children}
        <Footer className="mt-auto" />
      </div>
    </div>
  );
}
