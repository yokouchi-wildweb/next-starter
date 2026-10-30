// src/app/(user)/demo/field-layout/_screen/DemoFieldLayoutScreen.tsx
// /demo/field-layout(デモ)の既定画面。本体は client の DemoFieldLayoutDemo。

import type { ScreenProps } from "@/lib/screens/types";

import { DemoFieldLayoutDemo } from "./DemoFieldLayoutDemo";
import { loadDemoFieldLayoutScreen } from "./loader";

export async function DemoFieldLayoutScreen(props: ScreenProps) {
  await loadDemoFieldLayoutScreen(props);

  return <DemoFieldLayoutDemo />;
}
