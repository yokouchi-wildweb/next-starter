// src/components/DataTable/Table/Table.tsx

"use client";

import * as React from "react";
import { Table as BaseTable } from "@/components/Shadcn/table";
import { cn } from "@/lib/cn";
import { tableVariants, TableContext } from "./context";
import type { VariantProps } from "class-variance-authority";

export function Table({
  variant = "default",
  className,
  ...props
}: React.ComponentProps<"table"> & VariantProps<typeof tableVariants>) {
  return (
    <TableContext.Provider value={{ variant }}>
      <div data-slot="table-container" className="relative w-full overflow-x-auto">
        <BaseTable data-slot="table" className={cn(tableVariants({ variant, className }))} {...props} />
      </div>
    </TableContext.Provider>
  );
}
