// src/app/e2e/unsaved-guard/_screen/loader.ts
// 受入のテストのページ(未保存の編集の守り、e2e/unsavedGuard.spec.ts)の loader。access の評価だけ(public)。門番の規則 e2eFixtures が既定で閉じる

import "server-only";

import { createLoader } from "@/app/guard";

export const loadUnsavedGuardStartScreen = createLoader({
  access: "public",
  load: async (): Promise<void> => {},
});
