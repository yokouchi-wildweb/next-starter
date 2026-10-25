// src/app/admin/(protected)/_layout/Sidebar/SpSidebar.tsx

import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { AdminSidebarFrameProvider } from "@/app/admin/_layout/Sidebar/AdminSidebarFrame";

import { BaseSidebar } from "./BaseSidebar";

type SpSidebarProps = {
  width: number;
  isOpen: boolean;
  onClose?: () => void;
  /** 殻の中身。省略 = BaseSidebar */
  content?: ReactNode;
};

const noop = () => {};

export function SpSidebar({ width, isOpen, onClose, content }: SpSidebarProps) {
  return (
    <Fragment>
      <div
        style={{ width }}
        className={cn(
          "fixed inset-y-0 right-0 navigation-layer transition-transform md:hidden",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <AdminSidebarFrameProvider value={{ placement: "sp", width, close: onClose ?? noop }}>
          {content === undefined ? (
            <BaseSidebar width={width} onNavigate={onClose} submenuPlacement="left" submenuVariant="compact" />
          ) : (
            content
          )}
        </AdminSidebarFrameProvider>
      </div>
      {isOpen ? (
        <div className="fixed inset-0 backdrop-layer bg-overlay/50 md:hidden" onClick={onClose} />
      ) : null}
    </Fragment>
  );
}
