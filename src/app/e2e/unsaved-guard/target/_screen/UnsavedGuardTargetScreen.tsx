// src/app/e2e/unsaved-guard/target/_screen/UnsavedGuardTargetScreen.tsx
// 受入のテストの行き先のページ(進むの行き先にもなる)

import { Link } from "@/components/Navigation";
import { Main } from "@/components/Layout/Main";
import type { ScreenProps } from "@/lib/screens/types";

import { loadUnsavedGuardTargetScreen } from "./loader";

export async function UnsavedGuardTargetScreen(props: ScreenProps) {
  await loadUnsavedGuardTargetScreen(props);
  return (
    <Main>
      <h1 id="page">target</h1>
      <Link id="to-form" href="/e2e/unsaved-guard/form">form</Link>
    </Main>
  );
}
