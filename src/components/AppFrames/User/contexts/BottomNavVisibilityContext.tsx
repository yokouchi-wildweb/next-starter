"use client";

import { createVisibilityContext, type DeviceVisibility } from "./createVisibilityContext";

export type BottomNavVisibility = DeviceVisibility;

// デフォルト: スマホのみ表示
const { Provider, useVisibility } = createVisibilityContext<BottomNavVisibility>("BottomNav", {
  sp: true,
  pc: false,
});

export const BottomNavVisibilityProvider = Provider;

export const useBottomNavVisibility = useVisibility;
