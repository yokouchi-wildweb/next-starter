
import { cn } from "@/lib/cn";
import type { ComponentPropsWithoutRef } from "react";

type HiddenProps = ComponentPropsWithoutRef<"div">;

export function Hidden({ className, ...props }: HiddenProps) {
  return <div {...props} className={cn("hidden", className)} />;
}
