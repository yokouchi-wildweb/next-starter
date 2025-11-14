// src/components/DataTable/Table/TableCell.tsx

"use client";

import * as React from "react";
import { TableCell as BaseTableCell } from "@/components/Shadcn/table";
import { cn } from "@/lib/cn";
import { cellVariants, TableContext } from "./context";

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  const { variant } = React.useContext(TableContext);
  return <BaseTableCell data-slot="table-cell" className={cn(cellVariants({ variant, className }))} {...props} />;
}
