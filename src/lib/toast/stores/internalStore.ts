// lib/toast/stores/internalStore.ts

"use client";

import { create } from "zustand";
import type { Toast, ToastOptions } from "../types";
import { TOAST_DEFAULT_DURATION } from "../constants";

type ToastState = {
  toast: Toast | null;
  show: (options: ToastOptions) => string;
  hide: () => void;
  hideById: (id: string) => void;
};

export const internalStore = create<ToastState>((set) => ({
  toast: null,
  show: (options) => {
    const mode = options.mode ?? "notification";
    const isPersistent = mode === "persistent";

    const variant = options.variant ?? (isPersistent ? "loading" : "info");
    const isLoading = variant === "loading";
    const spinning = options.spinning ?? (isPersistent || isLoading);
    const position = options.position ?? "bottom-center";

    const id = crypto.randomUUID();
    set({
      toast: {
        id,
        message: options.message,
        variant,
        mode,
        position,
        duration: options.duration ?? TOAST_DEFAULT_DURATION,
        size: options.size ?? "md",
        spinning,
        icon: options.icon,
        layer: options.layer ?? "alert",
      },
    });
    return id;
  },
  hide: () => set({ toast: null }),
  hideById: (id) =>
    set((state) => (state.toast?.id === id ? { toast: null } : state)),
}));
