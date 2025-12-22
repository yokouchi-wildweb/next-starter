// src/config/ui-behavior-config.ts

export const UI_BEHAVIOR_CONFIG = [
  {
    routeTransitionOverlay: {
      message: "読み込み中です…",
      spinnerVariant: "default",
    },
    adminGlobalMenu: {
      submenuHideDelayMs: 639,
    },
    adminDataTable: {
      emptyFieldFallback: "(未設定)",
    },
  },
] as const;


