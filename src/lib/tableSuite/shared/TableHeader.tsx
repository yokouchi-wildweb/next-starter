// src/lib/tableSuite/shared/TableHeader.tsx

"use client";

import * as React from "react";
import { TableHeader as BaseTableHeader } from "@/components/_shadcn/table";
import { cn } from "@/lib/cn";
import { headerVariants, TableContext } from "./context";

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  const { variant } = React.useContext(TableContext);
  return <BaseTableHeader data-slot="table-header" className={cn(headerVariants({ variant, className }))} {...props} />;
}
