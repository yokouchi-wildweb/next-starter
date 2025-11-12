// src/components/Admin/layout/ResizableAdminLayout.tsx

"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { cn } from "@/lib/cn";
import { APP_FEATURES } from "@/config/app-features.config";

export function ResizableAdminLayout({
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
    <div className="flex flex-1 min-h-0 relative overflow-hidden">
      {/* mobile sidebar */}
      <div
        style={{ width: sidebarWidth }}
        className={cn(
          "fixed inset-y-0 left-0 above-header-layer transition-transform md:hidden",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <AdminSidebar width={sidebarWidth} onNavigate={onSidebarClose} />
      </div>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 backdrop-layer bg-black/50 md:hidden"
          onClick={onSidebarClose}
        />
      )}
      {/* desktop sidebar */}
      <div className="hidden md:block" style={{ width: sidebarWidth }}>
        <AdminSidebar width={sidebarWidth} />
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
      <main className="flex-1 min-h-0 overflow-auto p-4">{children}</main>
    </div>
  );
}
