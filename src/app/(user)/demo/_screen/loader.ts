// src/app/(user)/demo/_screen/loader.ts
// /demo(デモ)の loader。範囲 root(public。feature-gate の demo.samplePages で既定 404) の createLoader で access だけを評価する。
// デモの一覧から、閉じた機能のデモ(機能を閉じる規則に当たる住所)を除いて返す。

import "server-only";

import { createLoader } from "@/app/guard";
import { gate } from "@/featureGate";

import { demoHref } from "../_data/demoPages";
import { demoPages } from "../extensions/demoPages";

export const loadDemoIndexScreen = createLoader({
  access: "public",
  // 閉じた機能の住所のデモを除く(判定は gate.filter。画面の数・カテゴリの数はこの一覧から数える)
  load: async () => ({ pages: gate.filter(demoPages, demoHref) }),
});
