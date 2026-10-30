// src/app/(user)/demo/google-redirect/_screen/DemoGoogleRedirectScreen.tsx
// /demo/google-redirect(デモ)の既定画面。本体は client の DemoGoogleRedirectDemo。

import type { ScreenProps } from "@/lib/screens/types";

import { DemoGoogleRedirectDemo } from "./DemoGoogleRedirectDemo";
import { loadDemoGoogleRedirectScreen } from "./loader";

export async function DemoGoogleRedirectScreen(props: ScreenProps) {
  await loadDemoGoogleRedirectScreen(props);

  return <DemoGoogleRedirectDemo />;
}
