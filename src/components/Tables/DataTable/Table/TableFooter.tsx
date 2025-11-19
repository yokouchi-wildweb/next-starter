// src/components/Tables/DataTable/Table/TableFooter.tsx

"use client";

import * as React from "react";
import { TableFooter as BaseTableFooter } from "@/components/Shadcn/table";
import { cn } from "@/lib/cn";

export function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <BaseTableFooter
      data-slot="table-footer"
      className={cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}
