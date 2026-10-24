"use client";

import { createVisibilityContext, type DeviceVisibility } from "./createVisibilityContext";

export type FooterVisibility = DeviceVisibility;

const { Provider, useVisibility } = createVisibilityContext<FooterVisibility>("Footer", {
  sp: true,
  pc: true,
});

export const FooterVisibilityProvider = Provider;

export const useFooterVisibility = useVisibility;
