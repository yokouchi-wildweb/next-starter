// src/components/AppFrames/Admin/Insane/InsanePcSidebar.tsx

import { InsaneSidebar } from "./InsaneSidebar";

type InsanePcSidebarProps = {
  width: number;
};

export function InsanePcSidebar({ width }: InsanePcSidebarProps) {
  return (
    <div className="hidden md:block" style={{ width }}>
      <InsaneSidebar width={width} />
    </div>
  );
}
