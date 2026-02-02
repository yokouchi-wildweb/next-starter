// src/lib/tableSuite/shared/TableCellAction.tsx

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const TABLE_CELL_ACTION_CLASS =
  "flex justify-center items-center gap-2 opacity-0 transition-opacity pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto";

type TableCellActionProps = {
  children: ReactNode;
  className?: string;
};

export function TableCellAction({ children, className }: TableCellActionProps) {
  return <div className={cn(TABLE_CELL_ACTION_CLASS, className)}>{children}</div>;
}
