// src/app/(user)/demo/scroll-slider/_screen/DemoScrollSliderScreen.tsx
// /demo/scroll-slider(デモ)の既定画面。本体は client の DemoScrollSliderDemo。


import { createScreen } from "@/wiring/screen";

import { DemoScrollSliderDemo } from "./DemoScrollSliderDemo";
import { loadDemoScrollSliderScreen } from "./loader";

export const { Screen: DemoScrollSliderScreen, generateMetadata } = createScreen({
  load: loadDemoScrollSliderScreen,
  render: () => <DemoScrollSliderDemo />,
});
