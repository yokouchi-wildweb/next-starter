// src/app/admin/insane/_layout/InsaneSpSidebar.tsx

import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { AdminSidebarFrameProvider } from "@/app/admin/_layout/Sidebar/AdminSidebarFrame";

import { InsaneSidebar } from "./InsaneSidebar";

type InsaneSpSidebarProps = {
  width: number;
  isOpen: boolean;
  onClose?: () => void;
  /** 殻の中身。省略 = InsaneSidebar */
  content?: ReactNode;
};

const noop = () => {};

export function InsaneSpSidebar({ width, isOpen, onClose, content }: InsaneSpSidebarProps) {
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
            <InsaneSidebar width={width} onNavigate={onClose} submenuPlacement="left" submenuVariant="compact" />
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
