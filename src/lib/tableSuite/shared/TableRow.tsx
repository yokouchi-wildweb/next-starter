// src/lib/tableSuite/shared/TableRow.tsx

"use client";

import * as React from "react";
import { TableRow as BaseTableRow } from "@/components/_shadcn/table";
import { cn } from "@/lib/cn";
import { rowVariants, TableContext } from "./context";

type TableRowProps = React.ComponentProps<"tr"> & {
  disableHover?: boolean;
};

export function TableRow({ className, disableHover = false, ...props }: TableRowProps) {
  const { variant } = React.useContext(TableContext);
  return (
    <BaseTableRow
      data-slot="table-row"
      className={cn(
        rowVariants({ variant, hoverEffect: disableHover ? "disabled" : "enabled", className }),
      )}
      {...props}
    />
  );
}
