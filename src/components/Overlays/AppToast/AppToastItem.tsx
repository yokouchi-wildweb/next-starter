// src/components/Overlays/AppToast/AppToastItem.tsx

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
import type {
  AppToastItem as ToastData,
  AppToastVariant,
  AppToastSize,
  AppToastIconPreset,
} from "@/stores/appToast";

type Props = {
  toast: ToastData;
  onClose: () => void;
};

// プリセットアイコンの定義
const ICON_PRESETS: Record<AppToastIconPreset, typeof CheckCircle2Icon> = {
  success: CheckCircle2Icon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
  loading: Loader2Icon,
};

// variant毎のスタイル設定（defaultIconはプリセット名）
const VARIANT_CONFIG: Record<
  AppToastVariant,
  {
    defaultIcon: AppToastIconPreset;
    bgClass: string;
    iconClass: string;
    borderClass: string;
  }
> = {
  success: {
    defaultIcon: "success",
    bgClass: "bg-green-50 dark:bg-green-950/50",
    iconClass: "text-green-600 dark:text-green-400",
    borderClass: "border-green-200 dark:border-green-800",
  },
  error: {
    defaultIcon: "error",
    bgClass: "bg-red-50 dark:bg-red-950/50",
    iconClass: "text-red-600 dark:text-red-400",
    borderClass: "border-red-200 dark:border-red-800",
  },
  warning: {
    defaultIcon: "warning",
    bgClass: "bg-amber-50 dark:bg-amber-950/50",
    iconClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  info: {
    defaultIcon: "info",
    bgClass: "bg-blue-50 dark:bg-blue-950/50",
    iconClass: "text-blue-600 dark:text-blue-400",
    borderClass: "border-blue-200 dark:border-blue-800",
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
  AppToastSize,
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

const SWIPE_THRESHOLD = 50;

// プリセット文字列かどうかの判定
const isIconPreset = (icon: unknown): icon is AppToastIconPreset => {
  return typeof icon === "string" && icon in ICON_PRESETS;
};

export function AppToastItem({ toast, onClose }: Props) {
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
          Math.abs(mx) > SWIPE_THRESHOLD ||
          Math.abs(my) > SWIPE_THRESHOLD ||
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
        "flex items-center",
        "max-w-[90vw]",
        "rounded-xl border shadow-lg",
        variantConfig.bgClass,
        variantConfig.borderClass,
        "pointer-events-auto",
        "transition-[transform,opacity] duration-150",
        isNotification && "cursor-pointer select-none",
        sizeConfig.container,
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className={cn("shrink-0", variantConfig.iconClass)}>
        {IconComponent ? (
          <IconComponent
            className={cn(sizeConfig.icon, toast.spinning && "animate-spin")}
          />
        ) : (
          toast.icon
        )}
      </div>

      <p className={cn("relative flex-1 font-medium text-foreground", sizeConfig.text)}>
        {toast.message}
      </p>

      {isNotification && (
        <div
          className={cn(
            "relative shrink-0 p-1 rounded-full",
            "text-muted-foreground",
          )}
          aria-hidden="true"
        >
          <XIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
