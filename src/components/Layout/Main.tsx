// src/components/Layout/Main.tsx

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import FullScreen, { type FullScreenLayer } from "@/components/Layout/FullScreen";
import { cn } from "@/lib/cn";

const layoutVariants = cva("mx-auto w-full", {
  variants: {
    variant: {
      plain: "",
      narrowStack: "px-4 sm:px-6",
      contentShell: "px-4 sm:px-6 lg:px-8",
      wideShowcase: "px-4 sm:px-8 lg:px-12",
      fullscreen: "",
    },
  },
  defaultVariants: {
    variant: "contentShell",
  },
});

type LayoutVariant = NonNullable<VariantProps<typeof layoutVariants>["variant"]>;

const layoutMaxWidths: Partial<Record<LayoutVariant, CSSProperties["maxWidth"]>> = {
  narrowStack: "var(--layout-width-narrow-stack)",
  contentShell: "var(--layout-width-content-shell)",
  wideShowcase: "var(--layout-width-wide-showcase)",
};

export type MainProps = ComponentPropsWithoutRef<"main"> &
  VariantProps<typeof layoutVariants> & {
    children: ReactNode;
    fullscreenLayer?: FullScreenLayer;
  };

export function Main({
  variant,
  className,
  children,
  fullscreenLayer,
  id = "main",
  ...props
}: MainProps) {
  const effectiveVariant = variant ?? "basicContainer";

  if (effectiveVariant === "plain") {
    return (
      <main id={id} className={className} {...props}>
        {children}
      </main>
    );
  }

  if (effectiveVariant === "fullscreen") {
    return (
      <FullScreen layer={fullscreenLayer}>
        <main id={id} className={className} {...props}>
          {children}
        </main>
      </FullScreen>
    );
  }

  return (
    <div id={`${id}-container`}>
      <div
        id={`${id}-layout`}
        className={cn(layoutVariants({ variant: effectiveVariant }))}
        style={layoutMaxWidths[effectiveVariant] ? { maxWidth: layoutMaxWidths[effectiveVariant] } : undefined}
      >
        <main id={id} className={className} {...props}>
          {children}
        </main>
      </div>
    </div>
  );
}
