// src/components/Layout/Main.tsx

import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import FullScreen, { type FullScreenLayer } from "@/components/Layout/FullScreen";
import { APP_MAIN_ELEMENT_ID } from "@/constants/layout";
import { cn } from "@/lib/cn";

import { createLayoutVariants } from "./commonVariants";

const mainLayoutVariants = createLayoutVariants("mx-auto w-full");

type ContainerType =
  | "plain"
  | "narrowStack"
  | "contentShell"
  | "wideShowcase"
  | "fullscreen";

const layoutMaxWidths: Partial<Record<ContainerType, CSSProperties["maxWidth"]>> = {
  narrowStack: "var(--layout-width-narrow-stack)",
  contentShell: "var(--layout-width-content-shell)",
  wideShowcase: "var(--layout-width-wide-showcase)",
};

export type MainProps = ComponentPropsWithoutRef<"main"> &
  VariantProps<typeof mainLayoutVariants> & {
    children: ReactNode;
    containerType?: ContainerType;
    fullscreenLayer?: FullScreenLayer;
  };

export function Main({
  containerType,
  appearance,
  space,
  padding = "md",
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  className,
  children,
  fullscreenLayer,
  id = APP_MAIN_ELEMENT_ID,
  ...props

}: MainProps) {

  const effectiveContainerType = containerType ?? "contentShell";

  if (effectiveContainerType === "plain") {
    return (
      <main
        id={id}
        className={cn(
          "max-w-screen overflow-hidden",
          mainLayoutVariants({
            appearance,
            space,
            padding,
            paddingBlock,
            paddingInline,
            margin,
            marginBlock,
            marginInline,
          }),
          className,
        )}
        {...props}
      >
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
        className="my-auto mx-auto w-full max-w-screen overflow-x-hidden"
        style={
          layoutMaxWidths[effectiveContainerType]
            ? { maxWidth: layoutMaxWidths[effectiveContainerType] }
            : undefined
        }
      >
        <main
          id={id}
          className={cn(
            mainLayoutVariants({
              appearance,
              space,
              padding,
              paddingBlock,
              paddingInline,
              margin,
              marginBlock,
              marginInline,
            }),
            className,
          )}
          {...props}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
