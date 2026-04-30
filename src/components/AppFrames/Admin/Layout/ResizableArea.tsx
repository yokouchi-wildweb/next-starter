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

      {/* メイン領域: ここがスクロールコンテナ。Footer は内部末尾に流し込み、
          コンテンツが短い場合は flex-1 のスペーサで最下部に押し下げる sticky-bottom 構成 */}
      <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden">
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </div>
  );
}
