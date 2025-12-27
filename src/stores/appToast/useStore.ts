// stores/appToast/useStore.ts

"use client";

import { internalStore } from "./internalStore";

export function useAppToastStore() {
  const toast = internalStore((s) => s.toast);
  const show = internalStore((s) => s.show);
  const hide = internalStore((s) => s.hide);
  const hideById = internalStore((s) => s.hideById);

  return { toast, show, hide, hideById };
}
