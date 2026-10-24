"use client";

import { createVisibilityContext, type DeviceVisibility } from "./createVisibilityContext";

export type HeaderVisibility = DeviceVisibility;

const { Provider, useVisibility } = createVisibilityContext<HeaderVisibility>("Header", {
  sp: true,
  pc: true,
});

export const HeaderVisibilityProvider = Provider;

export const useHeaderVisibility = useVisibility;
