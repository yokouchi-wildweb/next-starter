// lib/toast/components/ToastItem.tsx

"use client";

import { useState } from "react";
import { useDrag } from "@use-gesture/react";
import {
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { TOAST_SWIPE_THRESHOLD } from "../constants";
import type {
  Toast,
  ToastVariant,
  ToastSize,
  ToastIconPreset,
} from "../types";

type Props = {
  toast: Toast;
  onClose: () => void;
};

// プリセットアイコンの定義
const ICON_PRESETS: Record<ToastIconPreset, typeof CheckCircle2Icon> = {
  success: CheckCircle2Icon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
  loading: Loader2Icon,
};

// variant毎のスタイル設定（defaultIconはプリセット名）
const VARIANT_CONFIG: Record<
  ToastVariant,
  {
    defaultIcon: ToastIconPreset;
    bgClass: string;
    iconClass: string;
    borderClass: string;
  }
> = {
  success: {
    defaultIcon: "success",
    bgClass: "bg-success/10",
    iconClass: "text-success",
    borderClass: "border-success/30",
  },
  error: {
    defaultIcon: "error",
    bgClass: "bg-destructive/10",
    iconClass: "text-destructive",
    borderClass: "border-destructive/30",
  },
  warning: {
    defaultIcon: "warning",
    bgClass: "bg-warning/10",
    iconClass: "text-warning",
    borderClass: "border-warning/30",
  },
  info: {
    defaultIcon: "info",
    bgClass: "bg-info/10",
    iconClass: "text-info",
    borderClass: "border-info/30",
  },
  loading: {
    defaultIcon: "loading",
    bgClass: "bg-gray-50 dark:bg-gray-950/50",
    iconClass: "text-gray-600 dark:text-gray-400",
    borderClass: "border-gray-200 dark:border-gray-800",
  },
  primary: {
    defaultIcon: "info",
    bgClass: "relative bg-white dark:bg-gray-900 before:absolute before:inset-0 before:bg-primary/15 before:rounded-xl",
    iconClass: "text-primary relative",
    borderClass: "border-primary/30",
  },
  secondary: {
    defaultIcon: "info",
    bgClass: "relative bg-white dark:bg-gray-900 before:absolute before:inset-0 before:bg-secondary/15 before:rounded-xl",
    iconClass: "text-secondary relative",
    borderClass: "border-secondary/30",
  },
  accent: {
    defaultIcon: "info",
    bgClass: "relative bg-white dark:bg-gray-900 before:absolute before:inset-0 before:bg-accent/15 before:rounded-xl",
    iconClass: "text-accent relative",
    borderClass: "border-accent/30",
  },
};

const SIZE_CONFIG: Record<
  ToastSize,
  {
    container: string;
    icon: string;
    text: string;
  }
> = {
  sm: {
    container: "gap-2 px-3 py-2 min-w-[240px] sm:min-w-[280px]",
    icon: "h-4 w-4",
    text: "text-xs",
  },
  md: {
    container: "gap-3 px-5 py-4 min-w-[280px] sm:min-w-[320px]",
    icon: "h-6 w-6",
    text: "text-sm",
  },
  lg: {
    container: "gap-4 px-6 py-5 min-w-[320px] sm:min-w-[400px]",
    icon: "h-7 w-7",
    text: "text-base",
  },
};

// プリセット文字列かどうかの判定
const isIconPreset = (icon: unknown): icon is ToastIconPreset => {
  return typeof icon === "string" && icon in ICON_PRESETS;
};

export function ToastItem({ toast, onClose }: Props) {
  const variantConfig = VARIANT_CONFIG[toast.variant];
  const sizeConfig = SIZE_CONFIG[toast.size];
  const isNotification = toast.mode === "notification";

  // アイコンコンポーネントの決定
  const getIconComponent = () => {
    if (toast.icon === undefined) {
      // 未指定 → variantのデフォルト
      return ICON_PRESETS[variantConfig.defaultIcon];
    }
    if (isIconPreset(toast.icon)) {
      // プリセット文字列
      return ICON_PRESETS[toast.icon];
    }
    // ReactNode → null（後で直接レンダリング）
    return null;
  };

  const IconComponent = getIconComponent();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(1);

  const bind = useDrag(
    ({ down, movement: [mx, my], velocity: [vx, vy], direction: [dx, dy] }) => {
      if (!isNotification) return;

      if (down) {
        setOffset({ x: mx, y: my });
        const distance = Math.sqrt(mx * mx + my * my);
        setOpacity(Math.max(0.5, 1 - distance / 200));
      } else {
        const velocityThreshold = 0.5;
        const shouldDismiss =
          Math.abs(mx) > TOAST_SWIPE_THRESHOLD ||
          Math.abs(my) > TOAST_SWIPE_THRESHOLD ||
          Math.abs(vx) > velocityThreshold ||
          Math.abs(vy) > velocityThreshold;

        if (shouldDismiss) {
          onClose();
        } else {
          setOffset({ x: 0, y: 0 });
          setOpacity(1);
        }
      }
    },
    {
      filterTaps: true,
      enabled: isNotification,
    },
  );

  const handleClick = () => {
    if (isNotification) {
      onClose();
    }
  };

  return (
    <div
      {...bind()}
      onClick={handleClick}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        opacity,
        touchAction: isNotification ? "none" : "auto",
      }}
      className={cn(
        "relative",
        "max-w-[90vw]",
        "rounded-xl border shadow-lg",
        variantConfig.borderClass,
        "pointer-events-auto",
        "transition-[transform,opacity] duration-150",
        isNotification && "cursor-pointer select-none",
        toast.className,
      )}
      role="alert"
      aria-live="assertive"
    >
      {/* 下層: 不透明な背景 */}
      <div className="absolute inset-0 rounded-xl bg-white dark:bg-gray-900" />
      {/* 上層: 透過色背景 + コンテンツ */}
      <div
        className={cn(
          "relative flex items-center",
          "rounded-xl",
          variantConfig.bgClass,
          sizeConfig.container,
          toast.className,
        )}
      >
        <div className={cn("shrink-0", variantConfig.iconClass, toast.iconClassName)}>
          {IconComponent ? (
            <IconComponent
              className={cn(sizeConfig.icon, toast.spinning && "animate-spin")}
            />
          ) : (
            toast.icon
          )}
        </div>

        <p className={cn("flex-1 font-medium text-foreground", sizeConfig.text, toast.textClassName)}>
          {toast.message}
        </p>

        {isNotification && (
          <div
            className={cn(
              "shrink-0 p-1 rounded-full",
              "text-muted-foreground",
            )}
            aria-hidden="true"
          >
            <XIcon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
