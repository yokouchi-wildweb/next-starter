// src/app/(user)/demo/overlay/_screen/DemoOverlayScreen.tsx
// /demo/overlay(デモ)の既定画面。本体は client の DemoOverlayDemo。


import { createScreen } from "@/wiring/screen";

import { DemoOverlayDemo } from "./DemoOverlayDemo";
import { loadDemoOverlayScreen } from "./loader";

export const { Screen: DemoOverlayScreen, generateMetadata } = createScreen({
  load: loadDemoOverlayScreen,
  render: () => <DemoOverlayDemo />,
});
