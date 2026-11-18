// src/lib/tableSuite/shared/TableCellAction.tsx

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Flex } from "@/components/Layout/Flex";

export const TABLE_CELL_ACTION_CLASS =
  "flex justify-center items-center gap-2 opacity-0 transition-opacity pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto";

type TableCellActionProps = {
  children: ReactNode;
  className?: string;
};

export function TableCellAction({ children, className }: TableCellActionProps) {
  // 並びは TABLE_CELL_ACTION_CLASS(公開の定数)のまま。Flex の既定の並びの class は tailwind-merge で上書きされる
  return <Flex className={cn(TABLE_CELL_ACTION_CLASS, className)}>{children}</Flex>;
}
