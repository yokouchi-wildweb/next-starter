// src/components/Layout/Main.tsx

import { type VariantProps } from "class-variance-authority";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { boxSpacingClassName, type BoxSpacingProps, type SpacingValue } from "@/lib/spacing";

import { createLayoutVariants } from "./appearance";
import { FullScreen, type FullScreenLayer } from "./FullScreen";

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

/** padding を書かない Main の内側の余白(12px → sm 以上で 16px) */
export const MAIN_DEFAULT_PADDING: SpacingValue = { base: "sm", sm: "md" };

export type MainProps = ComponentProps<"main"> &
  VariantProps<typeof mainLayoutVariants> &
  BoxSpacingProps & {
    children: ReactNode;
    containerType?: ContainerType;
    fullscreenLayer?: FullScreenLayer;
    /** 二重コンテナ構造時の内側コンテナのクラス名 */
    innerClassName?: string;
    /**
     * コンテンツの縦位置(main-layout の段を持つ型 = plain・fullscreen 以外で効く)。
     * - "center"(既定): 余白があれば縦中央寄せ(ログイン・エラー等の短いページ向け、従来の挙動)
     * - "start": 上揃え(縦に長いコンテンツのページ向け。中央寄せ由来の上の余白を出さない)
     */
    verticalAlign?: "center" | "start";
  };

export function Main({
  containerType,
  appearance,
  padding = MAIN_DEFAULT_PADDING,
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
  ...props
}: MainProps) {

  const effectiveContainerType = containerType ?? "contentShell";

  // 縦位置のクラス。先頭に置き、center のときの class 文字列を従来と同じ並びに保つ
  const verticalAlignClass = verticalAlign === "center" ? "my-auto" : "mt-0 mb-auto";

  if (effectiveContainerType === "plain") {
    return (
      <main
        data-slot="main"
        className={cn(
          "max-w-screen overflow-hidden",
          mainLayoutVariants({ appearance }),
          boxSpacingClassName({ padding, paddingBlock, paddingInline, margin, marginBlock, marginInline }),
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
          data-slot="main"
          className={cn(
            mainLayoutVariants({ appearance }),
            boxSpacingClassName({ padding, paddingBlock, paddingInline, margin, marginBlock, marginInline }),
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
      <div data-slot="main-container" className="flex flex-1 flex-col">
        <div
          data-slot="main-layout"
          className={cn(
            verticalAlignClass,
            "mx-auto w-full max-w-screen overflow-clip bg-surface",
            mainLayoutVariants({ appearance }),
            boxSpacingClassName({ padding, paddingBlock, paddingInline, margin, marginBlock, marginInline }),
            className,
          )}
          style={{ maxWidth: layoutMaxWidths.contentShell }}
        >
          <main
            data-slot="main"
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
    <div data-slot="main-container" className="flex flex-1 flex-col">
      <div
        data-slot="main-layout"
        className={cn(verticalAlignClass, "mx-auto w-full max-w-screen overflow-clip")}
        style={
          layoutMaxWidths[effectiveContainerType]
            ? { maxWidth: layoutMaxWidths[effectiveContainerType] }
            : undefined
        }
      >
        <main
          data-slot="main"
          className={cn(
            mainLayoutVariants({ appearance }),
            boxSpacingClassName({ padding, paddingBlock, paddingInline, margin, marginBlock, marginInline }),
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
