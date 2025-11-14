// src/components/Feedback/RouteTransitionOverlay.tsx
"use client";

import { LoadingOverlay } from "@/components/Feedback/LoadingOverlay";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui-behavior-config";
import { useRouteTransitionPending } from "@/hooks/useRouteTransitionPending";

const [{ routeTransitionOverlay }] = UI_BEHAVIOR_CONFIG;

/**
 * グローバルなルート遷移中に全画面のローディングを表示します。
 */
export function RouteTransitionOverlay() {
  const isPending = useRouteTransitionPending();

  if (!isPending) {
    return null;
  }

  return (
    <LoadingOverlay
      mode="fullscreen"
      message={routeTransitionOverlay.message}
      spinnerVariant={routeTransitionOverlay.spinnerVariant}
    />
  );
}
