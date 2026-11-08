// lib/toast/stores/internalStore.ts

"use client";

import { create } from "zustand";
import type { Toast, ToastOptions } from "../types";
import { toastConfig, type ToastConfig } from "../config";

type ToastState = {
  toast: Toast | null;
  show: (options: ToastOptions) => string;
  hide: () => void;
  hideById: (id: string) => void;
};

/** 設定を受けて store を作る(既定の位置・表示時間・大きさは設定から。show の options が優先) */
export function createToastStore(config: ToastConfig) {
  return create<ToastState>((set) => ({
    toast: null,
    show: (options) => {
      const mode = options.mode ?? "notification";
      const isPersistent = mode === "persistent";

      const variant = options.variant ?? (isPersistent ? "loading" : "info");
      const isLoading = variant === "loading";
      const spinning = options.spinning ?? (isPersistent || isLoading);
      const position = options.position ?? config.position;

      const id = crypto.randomUUID();
      set({
        toast: {
          id,
          message: options.message,
          variant,
          mode,
          position,
          duration: options.duration ?? config.duration,
          size: options.size ?? config.size,
          spinning,
          icon: options.icon,
          layer: options.layer ?? "alert",
          className: options.className,
          iconClassName: options.iconClassName,
          textClassName: options.textClassName,
          style: options.style,
        },
      });
      return id;
    },
    hide: () => set({ toast: null }),
    hideById: (id) => set((state) => (state.toast?.id === id ? { toast: null } : state)),
  }));
}

export const internalStore = createToastStore(toastConfig);
