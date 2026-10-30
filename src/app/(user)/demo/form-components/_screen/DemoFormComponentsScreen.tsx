// src/app/(user)/demo/form-components/_screen/DemoFormComponentsScreen.tsx
// /demo/form-components(デモ)の既定画面。本体は client の DemoFormComponentsDemo。

import type { ScreenProps } from "@/lib/screens/types";

import { DemoFormComponentsDemo } from "./DemoFormComponentsDemo";
import { loadDemoFormComponentsScreen } from "./loader";

export async function DemoFormComponentsScreen(props: ScreenProps) {
  await loadDemoFormComponentsScreen(props);

  return <DemoFormComponentsDemo />;
}
