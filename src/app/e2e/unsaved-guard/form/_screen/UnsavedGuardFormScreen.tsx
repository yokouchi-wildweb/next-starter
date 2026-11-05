// src/app/e2e/unsaved-guard/form/_screen/UnsavedGuardFormScreen.tsx
// 受入のテストのフォームのページ(AppForm = 編集済みの間は既定で守る)

import { Main } from "@/components/Layout/Main";
import type { ScreenProps } from "@/lib/screens/types";

import { loadUnsavedGuardFormScreen } from "./loader";
import { UnsavedGuardProbeForm } from "./UnsavedGuardProbeForm";

export async function UnsavedGuardFormScreen(props: ScreenProps) {
  await loadUnsavedGuardFormScreen(props);
  return (
    <Main>
      <h1 id="page">form</h1>
      <UnsavedGuardProbeForm />
    </Main>
  );
}
