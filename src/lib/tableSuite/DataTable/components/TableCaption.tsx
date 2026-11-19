// src/lib/tableSuite/DataTable/components/TableCaption.tsx

"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption data-slot="table-caption" className={cn("text-muted-foreground mt-4 text-sm", className)} {...props} />
  );
}
