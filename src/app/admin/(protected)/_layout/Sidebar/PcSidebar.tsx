// src/app/admin/(protected)/_layout/Sidebar/PcSidebar.tsx

import type { ReactNode } from "react";

import { AdminSidebarFrameProvider } from "@/app/admin/_layout/Sidebar/AdminSidebarFrame";

import { BaseSidebar } from "./BaseSidebar";

type PcSidebarProps = {
  width: number;
  /** 殻の中身。省略 = BaseSidebar */
  content?: ReactNode;
};

const noop = () => {};

export function PcSidebar({ width, content }: PcSidebarProps) {
  return (
    <div className="hidden md:block h-full" style={{ width }}>
      <AdminSidebarFrameProvider value={{ placement: "pc", width, close: noop }}>
        {content === undefined ? <BaseSidebar width={width} /> : content}
      </AdminSidebarFrameProvider>
    </div>
  );
}
