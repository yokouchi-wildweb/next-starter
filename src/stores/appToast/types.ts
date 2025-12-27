// stores/appToast/types.ts

import type { ReactNode } from "react";

export type AppToastMode = "notification" | "persistent";

export type AppToastVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "loading"
  | "primary"
  | "secondary"
  | "accent";

export type AppToastIconPreset = "success" | "error" | "warning" | "info" | "loading";

export type AppToastPosition =
  | "center"
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type AppToastSize = "sm" | "md" | "lg";

export type AppToastLayer = "alert" | "super" | "ultimate" | "apex";

export type AppToastItem = {
  id: string;
  message: string;
  variant: AppToastVariant;
  mode: AppToastMode;
  position: AppToastPosition;
  duration: number;
  size: AppToastSize;
  spinning: boolean;
  icon?: AppToastIconPreset | ReactNode;
  layer: AppToastLayer;
};

export type AppToastOptions = {
  message: string;
  variant?: AppToastVariant;
  mode?: AppToastMode;
  position?: AppToastPosition;
  duration?: number;
  size?: AppToastSize;
  spinning?: boolean;
  icon?: AppToastIconPreset | ReactNode;
  layer?: AppToastLayer;
};
