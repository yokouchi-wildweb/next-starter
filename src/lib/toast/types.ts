// lib/toast/types.ts

import type { ReactNode } from "react";

export type ToastMode = "notification" | "persistent";

export type ToastVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "loading"
  | "primary"
  | "secondary"
  | "accent";

export type ToastIconPreset = "success" | "error" | "warning" | "info" | "loading";

export type ToastPosition =
  | "center"
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type ToastSize = "sm" | "md" | "lg";

export type ToastLayer = "alert" | "super" | "ultimate" | "apex";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  mode: ToastMode;
  position: ToastPosition;
  duration: number;
  size: ToastSize;
  spinning: boolean;
  icon?: ToastIconPreset | ReactNode;
  layer: ToastLayer;
  /** トースト本体（背景・ボーダー等）のカスタムクラス */
  className?: string;
  /** アイコン部分のカスタムクラス */
  iconClassName?: string;
  /** テキスト部分のカスタムクラス */
  textClassName?: string;
};

export type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  mode?: ToastMode;
  position?: ToastPosition;
  duration?: number;
  size?: ToastSize;
  spinning?: boolean;
  icon?: ToastIconPreset | ReactNode;
  layer?: ToastLayer;
  /** トースト本体（背景・ボーダー等）のカスタムクラス */
  className?: string;
  /** アイコン部分のカスタムクラス */
  iconClassName?: string;
  /** テキスト部分のカスタムクラス */
  textClassName?: string;
};
