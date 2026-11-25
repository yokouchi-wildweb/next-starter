// src/app/(user)/demo/popover/_screen/DemoPopoverScreen.tsx
// /demo/popover(デモ)の既定画面。本体は client の DemoPopoverDemo。


import { createScreen } from "@/wiring/screen";

import { DemoPopoverDemo } from "./DemoPopoverDemo";
import { loadDemoPopoverScreen } from "./loader";

export const { Screen: DemoPopoverScreen, generateMetadata } = createScreen({
  load: loadDemoPopoverScreen,
  render: () => <DemoPopoverDemo />,
});
