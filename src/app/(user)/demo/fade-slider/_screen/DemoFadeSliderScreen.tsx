// src/app/(user)/demo/fade-slider/_screen/DemoFadeSliderScreen.tsx
// /demo/fade-slider(デモ)の既定画面。本体は client の DemoFadeSliderDemo。

import type { ScreenProps } from "@/lib/screens/types";

import { DemoFadeSliderDemo } from "./DemoFadeSliderDemo";
import { loadDemoFadeSliderScreen } from "./loader";

export async function DemoFadeSliderScreen(props: ScreenProps) {
  await loadDemoFadeSliderScreen(props);

  return <DemoFadeSliderDemo />;
}
