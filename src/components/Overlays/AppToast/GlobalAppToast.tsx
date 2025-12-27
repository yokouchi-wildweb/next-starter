// src/components/Overlays/AppToast/GlobalAppToast.tsx

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  useAppToastStore,
  type AppToastPosition,
  type AppToastLayer,
  type AppToastItem as ToastData,
} from "@/stores/appToast";
import { cn } from "@/lib/cn";
import { AppToastItem } from "./AppToastItem";

const POSITION_CLASSES: Record<AppToastPosition, string> = {
  center: "inset-0 flex items-center justify-center",
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-4 right-4",
};

const ENTER_ANIMATION_CLASSES: Record<AppToastPosition, string> = {
  center: "animate-bounce-drop fill-both",
  "top-left": "animate-in slide-in-from-left fade-in duration-200",
  "top-center": "animate-in slide-in-from-top fade-in duration-200",
  "top-right": "animate-in slide-in-from-right fade-in duration-200",
  "bottom-left": "animate-in slide-in-from-left fade-in duration-200",
  "bottom-center": "animate-in slide-in-from-bottom fade-in duration-200",
  "bottom-right": "animate-in slide-in-from-right fade-in duration-200",
};

const EXIT_ANIMATION_CLASSES: Record<AppToastPosition, string> = {
  center: "animate-bounce-up fill-forwards",
  "top-left": "animate-out slide-out-to-left fade-out duration-150 fill-forwards",
  "top-center": "animate-out slide-out-to-top fade-out duration-150 fill-forwards",
  "top-right": "animate-out slide-out-to-right fade-out duration-150 fill-forwards",
  "bottom-left": "animate-out slide-out-to-left fade-out duration-150 fill-forwards",
  "bottom-center": "animate-out slide-out-to-bottom fade-out duration-150 fill-forwards",
  "bottom-right": "animate-out slide-out-to-right fade-out duration-150 fill-forwards",
};

const EXIT_ANIMATION_DURATION = 350;

const LAYER_CLASSES: Record<AppToastLayer, string> = {
  alert: "alert-layer",
  super: "super-layer",
  ultimate: "ultimate-layer",
  apex: "apex-layer",
};

/**
 * グローバルアプリトーストをPortalでbody直下に描画するコンポーネント。
 * 画面中央または指定位置にリッチな通知を表示する。
 * ルートレイアウトに1つだけ配置して使用する。
 *
 * @example
 * // layout.tsx
 * <GlobalAppToast />
 *
 * // 使う側
 * const { showAppToast, hideAppToast } = useAppToast();
 * showAppToast("保存しました", "success");
 * showAppToast("エラー", "error", "top-center");
 */
export function GlobalAppToast() {
  const { toast: storeToast, hide: storeHide } = useAppToastStore();
  const [mounted, setMounted] = useState(false);
  const [displayedToast, setDisplayedToast] = useState<ToastData | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // storeのtoast変化を監視
  useEffect(() => {
    if (storeToast && storeToast.id !== displayedToast?.id) {
      // 新しいトーストが来た
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
      setIsExiting(false);
      setDisplayedToast(storeToast);
    } else if (!storeToast && displayedToast && !isExiting) {
      // トーストが消えた → 退出アニメーション開始
      setIsExiting(true);
      exitTimeoutRef.current = setTimeout(() => {
        setDisplayedToast(null);
        setIsExiting(false);
        exitTimeoutRef.current = null;
      }, EXIT_ANIMATION_DURATION);
    }
  }, [storeToast, displayedToast, isExiting]);

  // 自動消去タイマー
  useEffect(() => {
    if (!displayedToast) return;
    if (displayedToast.mode === "persistent") return;
    if (isExiting) return;

    const timer = setTimeout(() => {
      storeHide();
    }, displayedToast.duration);

    return () => clearTimeout(timer);
  }, [displayedToast, storeHide, isExiting]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    storeHide();
  }, [storeHide]);

  if (!mounted || !displayedToast) {
    return null;
  }

  const isCenter = displayedToast.position === "center";
  const animationClass = isExiting
    ? EXIT_ANIMATION_CLASSES[displayedToast.position]
    : ENTER_ANIMATION_CLASSES[displayedToast.position];
  const layerClass = LAYER_CLASSES[displayedToast.layer];

  const content = isCenter ? (
    <div
      className={cn(
        "fixed pointer-events-none",
        layerClass,
        POSITION_CLASSES[displayedToast.position],
      )}
      role="region"
      aria-label="通知"
    >
      <div className={animationClass}>
        <AppToastItem
          key={displayedToast.id}
          toast={displayedToast}
          onClose={handleClose}
        />
      </div>
    </div>
  ) : (
    <div
      className={cn(
        "fixed pointer-events-none",
        layerClass,
        POSITION_CLASSES[displayedToast.position],
        animationClass,
      )}
      role="region"
      aria-label="通知"
    >
      <AppToastItem
        key={displayedToast.id}
        toast={displayedToast}
        onClose={handleClose}
      />
    </div>
  );

  return createPortal(content, document.body);
}
