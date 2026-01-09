// src/components/AppFrames/Admin/Insane/InsaneResizableArea.tsx

"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { InsanePcSidebar } from "./InsanePcSidebar";
import { InsaneSpSidebar } from "./InsaneSpSidebar";

export function InsaneResizableArea({
  children,
  isSidebarOpen = false,
  onSidebarClose,
}: {
  children: ReactNode;
  isSidebarOpen?: boolean;
  onSidebarClose?: () => void;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(192);
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
    <div className="flex flex-1 min-h-0 relative">
      <InsaneSpSidebar width={sidebarWidth} isOpen={isSidebarOpen} onClose={onSidebarClose} />
      <InsanePcSidebar width={sidebarWidth} />

      {isSidebarResizable ? (
        <div
          onMouseDown={() => {
            dragging.current = true;
            document.body.style.cursor = "ew-resize";
          }}
          className="hidden md:block w-1 cursor-ew-resize bg-border hover:bg-muted shrink-0"
        />
      ) : null}

      <div className="flex-1 min-h-0 min-w-0 overflow-x-hidden">{children}</div>
    </div>
  );
}
