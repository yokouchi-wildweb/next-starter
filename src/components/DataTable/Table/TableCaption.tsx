// src/components/DataTable/Table/TableCaption.tsx

"use client";

import * as React from "react";
import { TableCaption as BaseTableCaption } from "@/components/Shadcn/table";
import { cn } from "@/lib/cn";

export function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <BaseTableCaption data-slot="table-caption" className={cn("text-muted-foreground mt-4 text-sm", className)} {...props} />
  );
}
