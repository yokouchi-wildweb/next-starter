// src/lib/tableSuite/shared/TableBody.tsx

"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { TableContext } from "./context";

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  React.useContext(TableContext);
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
