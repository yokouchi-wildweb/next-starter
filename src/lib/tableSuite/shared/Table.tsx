// src/lib/tableSuite/shared/Table.tsx

"use client";

import * as React from "react";
import { Table as BaseTable } from "@/components/_shadcn/table";
import { cn } from "@/lib/cn";
import { Block } from "@/components/Layout/Block";
import { tableVariants, TableContext } from "./context";
import type { VariantProps } from "class-variance-authority";

export function Table({
  variant = "default",
  className,
  tableLayout,
  ...props
}: React.ComponentProps<"table"> &
  VariantProps<typeof tableVariants> & { tableLayout?: "auto" | "fixed" }) {
  return (
    <TableContext.Provider value={{ variant }}>
      <Block data-slot="table-container" className="relative isolate w-full overflow-x-auto">
        <BaseTable
          data-slot="table"
          className={cn(tableVariants({ variant, className }), tableLayout && "w-full")}
          style={tableLayout ? { tableLayout } : undefined}
          {...props}
        />
      </Block>
    </TableContext.Provider>
  );
}
