
import { cn } from "@/lib/cn";
import type { ComponentProps } from "react";

type HiddenProps = ComponentProps<"div">;

export function Hidden({ className, ...props }: HiddenProps) {
  return <div data-component="Hidden" {...props} className={cn("hidden", className)} />;
}
