// src/lib/tableSuite/shared/TableHeader.tsx

"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { headerVariants, TableContext } from "./context";

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  const { variant } = React.useContext(TableContext);
  return <thead data-slot="table-header" className={cn(headerVariants({ variant, className }))} {...props} />;
}
