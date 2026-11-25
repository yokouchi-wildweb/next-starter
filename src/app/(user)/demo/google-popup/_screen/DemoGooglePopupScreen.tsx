// src/app/(user)/demo/google-popup/_screen/DemoGooglePopupScreen.tsx
// /demo/google-popup(デモ)の既定画面。本体は client の DemoGooglePopupDemo。


import { createScreen } from "@/wiring/screen";

import { DemoGooglePopupDemo } from "./DemoGooglePopupDemo";
import { loadDemoGooglePopupScreen } from "./loader";

export const { Screen: DemoGooglePopupScreen, generateMetadata } = createScreen({
  load: loadDemoGooglePopupScreen,
  render: () => <DemoGooglePopupDemo />,
});
