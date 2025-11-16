// src/components/Admin/layout/ResizableArea.tsx

"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { BaseSidebar } from "../Sections/SIdebar/BaseSidebar";
import { cn } from "@/lib/cn";
import { APP_FEATURES } from "@/config/app-features.config";

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
  const isSidebarResizable = APP_FEATURES.admin.layout.enableSidebarResizing;

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
      {/* mobile sidebar */}
      <div
        style={{ width: sidebarWidth }}
        className={cn(
          "fixed inset-y-0 right-0 modal-layer transition-transform md:hidden",
          isSidebarOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <BaseSidebar width={sidebarWidth} onNavigate={onSidebarClose} />
      </div>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 backdrop-layer bg-black/50 md:hidden"
          onClick={onSidebarClose}
        />
      )}

      {/* desktop sidebar */}
      <div className="hidden md:block" style={{ width: sidebarWidth }}>
        <BaseSidebar width={sidebarWidth} />
      </div>

      {isSidebarResizable ? (
        <div
          onMouseDown={() => {
            dragging.current = true;
            document.body.style.cursor = "ew-resize";
          }}
          className="hidden md:block w-1 cursor-ew-resize bg-border hover:bg-muted shrink-0"
        />
      ) : null}

      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
