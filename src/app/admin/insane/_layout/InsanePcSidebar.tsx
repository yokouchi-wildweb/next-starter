// src/app/admin/insane/_layout/InsanePcSidebar.tsx

import type { ReactNode } from "react";

import { AdminSidebarFrameProvider } from "@/app/admin/_layout/Sidebar/AdminSidebarFrame";

import { InsaneSidebar } from "./InsaneSidebar";

type InsanePcSidebarProps = {
  width: number;
  /** 殻の中身。省略 = InsaneSidebar */
  content?: ReactNode;
};

const noop = () => {};

export function InsanePcSidebar({ width, content }: InsanePcSidebarProps) {
  return (
    <div className="hidden md:block" style={{ width }}>
      <AdminSidebarFrameProvider value={{ placement: "pc", width, close: noop }}>
        {content === undefined ? <InsaneSidebar width={width} /> : content}
      </AdminSidebarFrameProvider>
    </div>
  );
}
