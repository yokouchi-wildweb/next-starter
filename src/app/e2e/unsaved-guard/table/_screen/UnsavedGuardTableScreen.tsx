// src/app/e2e/unsaved-guard/table/_screen/UnsavedGuardTableScreen.tsx
// 受入のテストの表のページ(EditableGridTable = 書きかけ・保存待ちの間は既定で守る)

import { Main } from "@/components/Layout/Main";
import type { ScreenProps } from "@/lib/screens/types";

import { loadUnsavedGuardTableScreen } from "./loader";
import { UnsavedGuardProbeTable } from "./UnsavedGuardProbeTable";

export async function UnsavedGuardTableScreen(props: ScreenProps) {
  await loadUnsavedGuardTableScreen(props);
  return (
    <Main>
      <h1 id="page">table</h1>
      <UnsavedGuardProbeTable />
    </Main>
  );
}
