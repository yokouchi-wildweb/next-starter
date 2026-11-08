// lib/toast/components/GlobalToast.tsx

"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import { useFrameDimsStyle } from "@/lib/frameDims";
import { useIsClient } from "@/lib/isClient";
import { useToastStore } from "../stores";
import { toastConfig } from "../config";
import { TOAST_EXIT_ANIMATION_DURATION } from "../constants";
import type { ToastPosition, ToastLayer, Toast } from "../types";
import { ToastItem } from "./ToastItem";

const POSITION_CLASSES: Record<ToastPosition, string> = {
  center: "inset-0 flex items-center justify-center",
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-[calc(var(--app-bottom-nav-height,0px)+1rem)] left-4",
  "bottom-center": "bottom-[calc(var(--app-bottom-nav-height,0px)+1rem)] left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-[calc(var(--app-bottom-nav-height,0px)+1rem)] right-4",
};

const ENTER_ANIMATION_CLASSES: Record<ToastPosition, string> = {
  center: "animate-bounce-drop fill-both",
  "top-left": "animate-in slide-in-from-left fade-in duration-200",
  "top-center": "animate-in slide-in-from-top fade-in duration-200",
  "top-right": "animate-in slide-in-from-right fade-in duration-200",
  "bottom-left": "animate-in slide-in-from-left fade-in duration-200",
  "bottom-center": "animate-in slide-in-from-bottom fade-in duration-200",
  "bottom-right": "animate-in slide-in-from-right fade-in duration-200",
};

const EXIT_ANIMATION_CLASSES: Record<ToastPosition, string> = {
  center: "animate-bounce-up fill-forwards",
  "top-left": "animate-out slide-out-to-left fade-out duration-150 fill-forwards",
  "top-center": "animate-out slide-out-to-top fade-out duration-150 fill-forwards",
  "top-right": "animate-out slide-out-to-right fade-out duration-150 fill-forwards",
  "bottom-left": "animate-out slide-out-to-left fade-out duration-150 fill-forwards",
  "bottom-center": "animate-out slide-out-to-bottom fade-out duration-150 fill-forwards",
  "bottom-right": "animate-out slide-out-to-right fade-out duration-150 fill-forwards",
};

const LAYER_CLASSES: Record<ToastLayer, string> = {
  alert: "alert-layer",
  super: "super-layer",
  ultimate: "ultimate-layer",
  apex: "apex-layer",
};

/**
 * グローバルトーストをPortalでbody直下に描画するコンポーネント。
 * 画面中央または指定位置にリッチな通知を表示する。
 * ルートレイアウトに1つだけ配置して使用する。
 *
 * @example
 * // layout.tsx
 * <GlobalToast />
 *
 * // 使う側
 * const { showToast, hideToast } = useToast();
 * showToast("保存しました", "success");
 * showToast("エラー", "error", "top-center");
 */
export function GlobalToast() {
  const { toast: storeToast, hide: storeHide } = useToastStore();
  const mounted = useIsClient();
  const [displayedToast, setDisplayedToast] = useState<Toast | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // storeのtoast変化を監視
  useEffect(() => {
    if (storeToast && storeToast.id !== displayedToast?.id) {
      // 新しいトーストが来た
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
      // store(外部)のトーストを表示用 state に写し、退出アニメーションのタイマーと組み合わせて切り替える。
      // 表示中のトーストは store から消えた後もアニメーションの間だけ残すため、render 中の導出では書けない
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsExiting(false);
      setDisplayedToast(storeToast);
    } else if (!storeToast && displayedToast && !isExiting) {
      // トーストが消えた → 退出アニメーション開始
      setIsExiting(true);
      exitTimeoutRef.current = setTimeout(() => {
        setDisplayedToast(null);
        setIsExiting(false);
        exitTimeoutRef.current = null;
      }, TOAST_EXIT_ANIMATION_DURATION);
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
      aria-label={toastConfig.ariaLabel}
    >
      <div className={animationClass}>
        <ToastItem
          key={displayedToast.id}
          toast={displayedToast}
          onClose={handleClose}
        />
      </div>
    </div>
  ) : (
    <FramedToastRegion
      className={cn(
        "fixed pointer-events-none",
        layerClass,
        POSITION_CLASSES[displayedToast.position],
        animationClass,
      )}
    >
      <ToastItem
        key={displayedToast.id}
        toast={displayedToast}
        onClose={handleClose}
      />
    </FramedToastRegion>
  );

  return createPortal(content, document.body);
}

/**
 * 隅に出すトーストの外側。body 直下へ portal するので外枠の寸法変数を継げず、useFrameDimsStyle で外枠の値を写す
 * (下寄せをボトムナビの上に出す。ナビを隠している間・出さないデバイスでは 0)。表示中の切り替えにも追随する。
 * トーストを出している間だけ描くので、外枠の監視もその間だけ。
 */
function FramedToastRegion({ className, children }: { className: string; children: ReactNode }) {
  const frameDims = useFrameDimsStyle();
  return (
    <div className={className} style={frameDims} role="region" aria-label={toastConfig.ariaLabel}>
      {children}
    </div>
  );
}
