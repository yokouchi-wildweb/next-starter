// src/components/Feedback/Skeleton/BaseSkeleton.tsx

import { Skeleton as ShadcnSkeleton } from "@/components/_shadcn/skeleton";
import { cn } from "@/lib/cn";
import type { ComponentProps, CSSProperties } from "react";

const shimmerKeyframes = `
@keyframes feedback-skeleton-shimmer {
  0% {
    transform: translateX(-100%);
    opacity: 0.15;
  }
  25% {
    opacity: 1;
  }
  50% {
    transform: translateX(100%);
    opacity: 0.15;
  }
  100% {
    transform: translateX(100%);
    opacity: 0.15;
  }
}
`;

const toneClassMap = {
  default: "bg-muted-foreground/30",
  subtle: "bg-muted/50",
  bold: "bg-muted-foreground/60",
} as const;

type BackgroundTone = keyof typeof toneClassMap;

type BaseSkeletonProps = ComponentProps<typeof ShadcnSkeleton> & {
  /** シマー演出を有効にするか */
  shimmer?: boolean;
  /** シマー帯の移動速度（秒） */
  shimmerSpeed?: number;
  /** シマー帯の幅（%） */
  shimmerWidth?: number;
  /** 背景の濃さ */
  backgroundTone?: BackgroundTone;
};

export function BaseSkeleton({
  className,
  shimmer = true,
  shimmerSpeed = 1.5,
  shimmerWidth = 60,
  backgroundTone = "default",
  style,
  children,
  ...rest
}: BaseSkeletonProps) {
  const widthPercent = Math.min(Math.max(shimmerWidth, 5), 100);

  const shimmerStyle: CSSProperties = {
    animation: `feedback-skeleton-shimmer ${shimmerSpeed}s linear infinite`,
    width: `${widthPercent}%`,
  };

  return (
    <ShadcnSkeleton
      className={cn(
        "relative overflow-hidden",
        toneClassMap[backgroundTone] ?? toneClassMap.default,
        className,
      )}
      style={style}
      {...rest}
    >
      {shimmer && (
        <>
          <style dangerouslySetInnerHTML={{ __html: shimmerKeyframes }} />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-background/60 to-transparent"
            style={shimmerStyle}
          />
        </>
      )}
      {children}
    </ShadcnSkeleton>
  );
}
