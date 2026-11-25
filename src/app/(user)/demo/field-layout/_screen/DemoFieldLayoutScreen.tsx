// src/app/(user)/demo/field-layout/_screen/DemoFieldLayoutScreen.tsx
// /demo/field-layout(デモ)の既定画面。本体は client の DemoFieldLayoutDemo。


import { createScreen } from "@/wiring/screen";

import { DemoFieldLayoutDemo } from "./DemoFieldLayoutDemo";
import { loadDemoFieldLayoutScreen } from "./loader";

export const { Screen: DemoFieldLayoutScreen, generateMetadata } = createScreen({
  load: loadDemoFieldLayoutScreen,
  render: () => <DemoFieldLayoutDemo />,
});
