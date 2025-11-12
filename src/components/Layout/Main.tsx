// src/components/Layout/Main.tsx

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import FullScreen, { type FullScreenLayer } from "@/components/Layout/FullScreen";
import { APP_MAIN_ELEMENT_ID } from "@/constants/layout";
import { cn } from "@/lib/cn";

import { layoutVariants as commonLayoutVariants } from "./commonVariants";

const mainLayoutVariants = cva("mx-auto w-full", {
  variants: {
    variant: {
      plain: "",
      narrowStack: "",
      contentShell: "",
      wideShowcase: "",
      fullscreen: "",
    },
    padding: commonLayoutVariants.padding,
    margin: commonLayoutVariants.margin,
  },
  defaultVariants: {
    variant: "contentShell",
    padding: "md",
    margin: "none",
  },
});

type LayoutVariant = NonNullable<VariantProps<typeof mainLayoutVariants>["variant"]>;

const layoutMaxWidths: Partial<Record<LayoutVariant, CSSProperties["maxWidth"]>> = {
  narrowStack: "var(--layout-width-narrow-stack)",
  contentShell: "var(--layout-width-content-shell)",
  wideShowcase: "var(--layout-width-wide-showcase)",
};

export type MainProps = ComponentPropsWithoutRef<"main"> &
  VariantProps<typeof mainLayoutVariants> & {
    children: ReactNode;
    fullscreenLayer?: FullScreenLayer;
  };

export function Main({
  variant,
  padding,
  margin,
  className,
  children,
  fullscreenLayer,
  id = APP_MAIN_ELEMENT_ID,
  ...props

}: MainProps) {

  const effectiveVariant = variant ?? "contentShell";

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
    <div id={`${id}-container`} className="flex flex-1 flex-col">
      <div
        id={`${id}-layout`}
        className="my-auto"
        style={layoutMaxWidths[effectiveVariant] ? { maxWidth: layoutMaxWidths[effectiveVariant] } : undefined}
      >
        <main
            id={id}
            className={cn(
                mainLayoutVariants({ variant: effectiveVariant, padding, margin }),
                className,
            )}
            {...props}>
          {children}
        </main>
      </div>
    </div>
  );
}
