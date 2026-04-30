// src/components/Admin/Sections/SIdebar/PcSidebar.tsx

import { BaseSidebar } from "./BaseSidebar";

type PcSidebarProps = {
  width: number;
};

export function PcSidebar({ width }: PcSidebarProps) {
  return (
    <div className="hidden md:block h-full" style={{ width }}>
      <BaseSidebar width={width} />
    </div>
  );
}
