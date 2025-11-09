
import { cn } from "@/lib/cn";
import type { ComponentPropsWithoutRef } from "react";

type InBlockProps = ComponentPropsWithoutRef<"span">;

export function InBlock({ className, ...props }: InBlockProps) {
  return (
    <span {...props} className={cn("inline-block p-2", className)} />
  );
}
