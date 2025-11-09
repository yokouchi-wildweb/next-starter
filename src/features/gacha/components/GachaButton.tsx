// src/features/gacha/components/GachaButton.tsx

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const gachaButtonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center rounded-full font-extrabold text-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70",
  {
    variants: {
      tone: {
        bounce:
          "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 shadow-2xl border-4 border-white animate-bounce hover:scale-110 hover:brightness-110",
        pulse:
          "bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-500 shadow-xl border-4 border-white animate-pulse hover:scale-110 hover:brightness-110",
        complete: "bg-gray-400 shadow-2xl border-4 border-white",
      },
      size: {
        md: "px-4 py-3 text-2xl",
        lg: "px-12 py-6 text-3xl",
        xl: "px-12 py-6 text-4xl",
      },
    },
    defaultVariants: {
      tone: "bounce",
      size: "lg",
    },
  },
);

export type GachaButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof gachaButtonVariants>;

export const GachaButton = React.forwardRef<HTMLButtonElement, GachaButtonProps>(
  ({ tone, size, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(gachaButtonVariants({ tone, size }), className)}
        {...props}
      />
    );
  },
);

GachaButton.displayName = "GachaButton";
