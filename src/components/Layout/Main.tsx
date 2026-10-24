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
  | "snugVessel"
  | "contentShell"
  | "wideShowcase"
  | "surfaceDisplay"
  | "fullscreen";

const layoutMaxWidths: Partial<Record<ContainerType, CSSProperties["maxWidth"]>> = {
  narrowStack: "var(--layout-width-narrow-stack)",
  snugVessel: "var(--layout-width-snug-vessel)",
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
    /**
     * コンテンツの縦位置(Main:layout を持つ型 = plain・fullscreen 以外で効く)。
     * - "center"(既定): 余白があれば縦中央寄せ(ログイン・エラー等の短いページ向け、従来の挙動)
     * - "start": 上揃え(縦に長いコンテンツのページ向け。中央寄せ由来の上の余白を出さない)
     */
    verticalAlign?: "center" | "start";
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
  verticalAlign = "center",
  id = "main",
  ...props
}: MainProps) {

  const effectiveContainerType = containerType ?? "contentShell";

  // 縦位置のクラス。先頭に置き、center のときの class 文字列を従来と同じ並びに保つ
  const verticalAlignClass = verticalAlign === "center" ? "my-auto" : "mt-0 mb-auto";

  if (effectiveContainerType === "plain") {
    return (
      <main
        data-component="Main"
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
        <main
          data-component="Main"
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
      </FullScreen>
    );
  }

  if (effectiveContainerType === "surfaceDisplay") {
    return (
      <div data-component="Main:container" id={`${id}-container`} className="flex flex-1 flex-col">
        <div
          data-component="Main:layout"
          id={`${id}-layout`}
          className={cn(
            verticalAlignClass,
            "mx-auto w-full max-w-screen overflow-clip bg-surface",
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
            data-component="Main"
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
    <div data-component="Main:container" id={`${id}-container`} className="flex flex-1 flex-col">
      <div
        data-component="Main:layout"
        id={`${id}-layout`}
        className={cn(verticalAlignClass, "mx-auto w-full max-w-screen overflow-clip")}
        style={
          layoutMaxWidths[effectiveContainerType]
            ? { maxWidth: layoutMaxWidths[effectiveContainerType] }
            : undefined
        }
      >
        <main
          data-component="Main"
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
