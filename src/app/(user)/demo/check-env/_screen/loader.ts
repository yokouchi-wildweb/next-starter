// src/app/(user)/demo/check-env/_screen/loader.ts
// /demo/check-env(Firebase 関連の環境変数の確認デモ)の loader。範囲 root の createLoader で access は管理者カテゴリ
// (環境変数とサービスアカウントの要約を出すので未ログインには 404。L1.19)。要約は SSR で組み立てる。

import "server-only";

import { buildEnvSummary } from "../api/envSummary";
import { createLoader } from "@/app/guard";

export const loadDemoCheckEnvScreen = createLoader({
  access: { roleCategories: ["admin"] },
  load: async () => buildEnvSummary(),
});
