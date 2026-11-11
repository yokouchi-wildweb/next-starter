// src/components/Primitives/Label/Label.tsx

"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/cn";

/** 印(data-slot)。form-label は上流の包む部品(フォームの項目のラベル)が渡す。fork は名前を変えずに印を狙う */
export type LabelSlot = "label" | "form-label";

type LabelProps = Omit<React.ComponentProps<typeof LabelPrimitive.Root>, "slot"> & {
  /** 印の名前(上流の包む部品だけが使う。既定 label)。props の data-slot はこれに負ける */
  slot?: LabelSlot;
};

function Label({ className, slot = "label", ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className,
      )}
      {...props}
      data-slot={slot}
    />
  );
}

export { Label };
export type { LabelProps };
