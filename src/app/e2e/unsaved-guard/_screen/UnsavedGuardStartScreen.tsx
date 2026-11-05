// src/app/e2e/unsaved-guard/_screen/UnsavedGuardStartScreen.tsx
// 受入のテストの出発のページ(戻るの行き先)

import { Link } from "@/components/Navigation";
import { Main } from "@/components/Layout/Main";
import type { ScreenProps } from "@/lib/screens/types";

import { loadUnsavedGuardStartScreen } from "./loader";

export async function UnsavedGuardStartScreen(props: ScreenProps) {
  await loadUnsavedGuardStartScreen(props);
  return (
    <Main>
      <h1 id="page">start</h1>
      <Link id="to-form" href="/e2e/unsaved-guard/form">form</Link>
    </Main>
  );
}
