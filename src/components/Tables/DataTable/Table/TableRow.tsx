// src/components/Tables/DataTable/Table/TableRow.tsx

"use client";

import * as React from "react";
import { TableRow as BaseTableRow } from "@/components/Shadcn/table";
import { cn } from "@/lib/cn";
import { rowVariants, TableContext } from "./context";

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  const { variant } = React.useContext(TableContext);
  return <BaseTableRow data-slot="table-row" className={cn(rowVariants({ variant, className }))} {...props} />;
}
