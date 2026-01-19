// src/components/Layout/Main.tsx

import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import FullScreen, { type FullScreenLayer } from "@/components/Layout/FullScreen";
import { cn } from "@/lib/cn";

import { createLayoutVariants } from "./commonVariants";

const mainLayoutVariants = createLayoutVariants("mx-auto w-full");

type ContainerType =
  | "plain"
  | "narrowStack"
  | "contentShell"
  | "wideShowcase"
  | "surfaceDisplay"
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
    /** 二重コンテナ構造時の内側コンテナのクラス名 */
    innerClassName?: string;
  };

export function Main({
  containerType,
  appearance,
  padding = "md",
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  className,
  children,
  fullscreenLayer,
  innerClassName,
  id = "main",
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

  if (effectiveContainerType === "surfaceDisplay") {
    return (
      <div id={`${id}-container`} className="flex flex-1 flex-col">
        <div
          id={`${id}-layout`}
          className={cn(
            "my-auto mx-auto w-full max-w-screen overflow-clip bg-surface",
            mainLayoutVariants({
              appearance,
              padding,
              paddingBlock,
              paddingInline,
              margin,
              marginBlock,
              marginInline,
            }),
            className,
          )}
          style={{ maxWidth: layoutMaxWidths.contentShell }}
        >
          <main
            id={id}
            className={cn("mx-auto w-full", innerClassName)}
            style={{ maxWidth: layoutMaxWidths.narrowStack }}
            {...props}
          >
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div id={`${id}-container`} className="flex flex-1 flex-col">
      <div
        id={`${id}-layout`}
        className="my-auto mx-auto w-full max-w-screen overflow-clip"
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
