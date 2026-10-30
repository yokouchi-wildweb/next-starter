// src/app/(user)/demo/scroll-slider/_screen/DemoScrollSliderScreen.tsx
// /demo/scroll-slider(デモ)の既定画面。本体は client の DemoScrollSliderDemo。

import type { ScreenProps } from "@/lib/screens/types";

import { DemoScrollSliderDemo } from "./DemoScrollSliderDemo";
import { loadDemoScrollSliderScreen } from "./loader";

export async function DemoScrollSliderScreen(props: ScreenProps) {
  await loadDemoScrollSliderScreen(props);

  return <DemoScrollSliderDemo />;
}
