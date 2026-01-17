// lib/toast/index.ts

// フック
export { useToast } from "./useToast";
export { useLoadingToast } from "./useLoadingToast";

// ストア（内部的に使用する場合のみ）
export { useToastStore } from "./stores";

// コンポーネント
export { GlobalToast, ToastItem } from "./components";

// リダイレクトトースト
export { RedirectToastProvider, setRedirectToastCookie } from "./redirect";

// 型
export type {
  ToastMode,
  ToastVariant,
  ToastIconPreset,
  ToastPosition,
  ToastSize,
  ToastLayer,
  ToastItem,
  ToastOptions,
} from "./types";

export type { RedirectToastPayload, RedirectToastVariant } from "./redirect";
