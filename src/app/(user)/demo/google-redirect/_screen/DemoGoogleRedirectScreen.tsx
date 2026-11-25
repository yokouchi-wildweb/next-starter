// src/app/(user)/demo/google-redirect/_screen/DemoGoogleRedirectScreen.tsx
// /demo/google-redirect(デモ)の既定画面。本体は client の DemoGoogleRedirectDemo。


import { createScreen } from "@/wiring/screen";

import { DemoGoogleRedirectDemo } from "./DemoGoogleRedirectDemo";
import { loadDemoGoogleRedirectScreen } from "./loader";

export const { Screen: DemoGoogleRedirectScreen, generateMetadata } = createScreen({
  load: loadDemoGoogleRedirectScreen,
  render: () => <DemoGoogleRedirectDemo />,
});
