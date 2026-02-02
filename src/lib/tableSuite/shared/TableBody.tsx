// src/lib/tableSuite/shared/TableBody.tsx

"use client";

import * as React from "react";
import { TableBody as BaseTableBody } from "@/components/_shadcn/table";
import { cn } from "@/lib/cn";
import { TableContext } from "./context";

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  React.useContext(TableContext);
  return <BaseTableBody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
