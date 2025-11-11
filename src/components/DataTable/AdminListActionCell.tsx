// src/components/DataTable/AdminListActionCell.tsx

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const ADMIN_LIST_ACTION_CELL_CLASS =
  "flex justify-end gap-2 opacity-0 transition-opacity pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto";

type AdminListActionCellProps = {
  children: ReactNode;
  className?: string;
};

export function AdminListActionCell({ children, className }: AdminListActionCellProps) {
  return <div className={cn(ADMIN_LIST_ACTION_CELL_CLASS, className)}>{children}</div>;
}
