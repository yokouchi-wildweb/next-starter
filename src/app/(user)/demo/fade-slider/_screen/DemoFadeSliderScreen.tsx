// src/app/(user)/demo/fade-slider/_screen/DemoFadeSliderScreen.tsx
// /demo/fade-slider(デモ)の既定画面。本体は client の DemoFadeSliderDemo。


import { createScreen } from "@/wiring/screen";

import { DemoFadeSliderDemo } from "./DemoFadeSliderDemo";
import { loadDemoFadeSliderScreen } from "./loader";

export const { Screen: DemoFadeSliderScreen, generateMetadata } = createScreen({
  load: loadDemoFadeSliderScreen,
  render: () => <DemoFadeSliderDemo />,
});
