// src/components/Feedback/RouteTransition.tsx
"use client";

import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import { useRouteTransitionPending } from "@/hooks/useRouteTransitionPending";

const [{ routeTransitionOverlay: routeTransition }] = UI_BEHAVIOR_CONFIG;

/**
 * グローバルなルート遷移中に全画面のローディングを表示します。
 */
export function RouteTransitionOverlay() {
  const isPending = useRouteTransitionPending();

  if (!isPending) {
    return null;
  }

  return (
    <ScreenLoader
      mode="fullscreen"
      message={routeTransition.message}
      spinnerVariant={routeTransition.spinnerVariant}
    />
  );
}
