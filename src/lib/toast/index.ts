// lib/toast/index.ts

// フック
export { useToast } from "./useToast";
export { useLoadingToast } from "./useLoadingToast";

// ストア（内部的に使用する場合のみ）
export { useToastStore } from "./stores";

// コンポーネント
export { GlobalToast, ToastItem } from "./components";

// トーストの領域の印と、押した所がトーストの中かの判定(浮く物の外押しの判定が使う)
export { TOAST_REGION_SLOT, isToastTarget } from "./target";

// リダイレクトトースト
export { RedirectToastProvider, setRedirectToastCookie } from "./redirect";

// 型
export type {
  ToastMode,
  ToastVariant,
  ToastIconPreset,
  ToastPosition,
  ToastSize,
  Toast,
  ToastOptions,
} from "./types";

export type { RedirectToastPayload, RedirectToastVariant } from "./redirect";

// 設定(上書きのファイル src/config/lib/toast.config.ts の型)
export type { ToastConfig, ToastOverride } from "./config";
