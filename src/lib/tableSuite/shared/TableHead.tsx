// src/lib/tableSuite/shared/TableHead.tsx

"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { headVariants, TableContext } from "./context";

export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  const { variant } = React.useContext(TableContext);
  return <th data-slot="table-head" className={cn("h-10 px-2 text-left", headVariants({ variant, className }))} {...props} />;
}
