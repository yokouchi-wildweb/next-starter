// src/stores/useLoadingToastStore.ts

"use client";

import { create } from "zustand";
import type { SpinnerVariant } from "@/components/Overlays/Loading/Spinner";

export type LoadingToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type LoadingToastSize = "sm" | "md" | "lg";

export type LoadingToastOptions = {
  message?: string;
  spinnerVariant?: SpinnerVariant;
  position?: LoadingToastPosition;
  size?: LoadingToastSize;
};

type LoadingToastState = {
  isVisible: boolean;
  options: LoadingToastOptions;
  setVisible: (visible: boolean) => void;
  setOptions: (options: LoadingToastOptions) => void;
};

export const useLoadingToastStore = create<LoadingToastState>((set) => ({
  isVisible: false,
  options: {},
  setVisible: (visible) => set({ isVisible: visible }),
  setOptions: (options) => set({ options }),
}));
