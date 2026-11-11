// src/lib/globalLoader/stores/internalStore.ts

"use client";

import { create } from "zustand";
import type { ReactNode } from "react";
import type { LoaderSpinnerVariant } from "../spinner";

export type LoaderOptions = {
  message?: ReactNode;
  spinnerVariant?: LoaderSpinnerVariant;
  spinnerClassName?: string;
  messageClassName?: string;
  className?: string;
  zIndex?: number;
};

type GlobalLoaderState = {
  isVisible: boolean;
  options: LoaderOptions;
  setVisible: (visible: boolean) => void;
  setOptions: (options: LoaderOptions) => void;
};

export const internalStore = create<GlobalLoaderState>((set) => ({
  isVisible: false,
  options: {},
  setVisible: (visible) => set({ isVisible: visible }),
  setOptions: (options) => set({ options }),
}));
