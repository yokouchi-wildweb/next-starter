// src/app/(user)/demo/form-components/_screen/DemoFormComponentsScreen.tsx
// /demo/form-components(デモ)の既定画面。本体は client の DemoFormComponentsDemo。


import { createScreen } from "@/wiring/screen";

import { DemoFormComponentsDemo } from "./DemoFormComponentsDemo";
import { loadDemoFormComponentsScreen } from "./loader";

export const { Screen: DemoFormComponentsScreen, generateMetadata } = createScreen({
  load: loadDemoFormComponentsScreen,
  render: () => <DemoFormComponentsDemo />,
});
