"use client";

import { createVisibilityContext, type DeviceVisibility } from "./createVisibilityContext";

export type HeaderNavVisibility = DeviceVisibility;

const { Provider, useVisibility } = createVisibilityContext<HeaderNavVisibility>("HeaderNav", {
  sp: true,
  pc: true,
});

export const HeaderNavVisibilityProvider = Provider;

export const useHeaderNavVisibility = useVisibility;
