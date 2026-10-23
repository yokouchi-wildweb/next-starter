// src/components/AppFrames/Admin/Insane/InsaneSpSidebar.tsx

import { Fragment } from "react";

import { cn } from "@/lib/cn";

import { InsaneSidebar } from "./InsaneSidebar";

type InsaneSpSidebarProps = {
  width: number;
  isOpen: boolean;
  onClose?: () => void;
};

export function InsaneSpSidebar({ width, isOpen, onClose }: InsaneSpSidebarProps) {
  return (
    <Fragment>
      <div
        style={{ width }}
        className={cn(
          "fixed inset-y-0 right-0 navigation-layer transition-transform md:hidden",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <InsaneSidebar width={width} onNavigate={onClose} submenuPlacement="left" submenuVariant="compact" />
      </div>
      {isOpen ? (
        <div className="fixed inset-0 backdrop-layer bg-overlay/50 md:hidden" onClick={onClose} />
      ) : null}
    </Fragment>
  );
}
