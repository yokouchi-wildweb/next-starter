// src/app/(user)/demo/google-popup/_screen/DemoGooglePopupScreen.tsx
// /demo/google-popup(デモ)の既定画面。本体は client の DemoGooglePopupDemo。

import type { ScreenProps } from "@/lib/screens/types";

import { DemoGooglePopupDemo } from "./DemoGooglePopupDemo";
import { loadDemoGooglePopupScreen } from "./loader";

export async function DemoGooglePopupScreen(props: ScreenProps) {
  await loadDemoGooglePopupScreen(props);

  return <DemoGooglePopupDemo />;
}
