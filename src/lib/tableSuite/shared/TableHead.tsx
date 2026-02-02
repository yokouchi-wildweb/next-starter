// src/lib/tableSuite/shared/TableHead.tsx

"use client";

import * as React from "react";
import { TableHead as BaseTableHead } from "@/components/_shadcn/table";
import { cn } from "@/lib/cn";
import { headVariants, TableContext } from "./context";

export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  const { variant } = React.useContext(TableContext);
  return <BaseTableHead data-slot="table-head" className={cn(headVariants({ variant, className }))} {...props} />;
}
