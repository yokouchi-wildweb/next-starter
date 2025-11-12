// src/components/Layout/Main.tsx

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import FullScreen, { type FullScreenLayer } from "@/components/Layout/FullScreen";
import { APP_MAIN_ELEMENT_ID } from "@/constants/layout";
import { cn } from "@/lib/cn";

import { layoutVariants as commonLayoutVariants } from "./commonVariants";

const mainLayoutVariants = cva("mx-auto w-full", {
  variants: {
    containerType: {
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
    containerType: "contentShell",
    padding: "md",
    margin: "none",
  },
});

type ContainerType = NonNullable<VariantProps<typeof mainLayoutVariants>["containerType"]>;

const layoutMaxWidths: Partial<Record<ContainerType, CSSProperties["maxWidth"]>> = {
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
  containerType,
  padding,
  margin,
  className,
  children,
  fullscreenLayer,
  id = APP_MAIN_ELEMENT_ID,
  ...props

}: MainProps) {

  const effectiveContainerType = containerType ?? "contentShell";

  if (effectiveContainerType === "plain") {
    return (
      <main id={id} className={className} {...props}>
        {children}
      </main>
    );
  }

  if (effectiveContainerType === "fullscreen") {
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
        style={
          layoutMaxWidths[effectiveContainerType]
            ? { maxWidth: layoutMaxWidths[effectiveContainerType] }
            : undefined
        }
      >
        <main
            id={id}
            className={cn(
                mainLayoutVariants({ containerType: effectiveContainerType, padding, margin }),
                className,
            )}
            {...props}>
          {children}
        </main>
      </div>
    </div>
  );
}
