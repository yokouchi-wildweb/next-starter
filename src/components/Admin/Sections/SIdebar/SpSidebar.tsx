// src/components/Admin/Sections/SIdebar/SpSidebar.tsx

import { Fragment } from "react";

import { cn } from "@/lib/cn";

import { BaseSidebar } from "./BaseSidebar";

type SpSidebarProps = {
  width: number;
  isOpen: boolean;
  onClose?: () => void;
};

export function SpSidebar({ width, isOpen, onClose }: SpSidebarProps) {
  return (
    <Fragment>
      <div
        style={{ width }}
        className={cn(
          "fixed inset-y-0 right-0 navigation-layer transition-transform md:hidden",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <BaseSidebar width={width} onNavigate={onClose} submenuPlacement="left" submenuVariant="compact" />
      </div>
      {isOpen ? (
        <div className="fixed inset-0 backdrop-layer bg-black/50 md:hidden" onClick={onClose} />
      ) : null}
    </Fragment>
  );
}
