// tests/e2e/featureGate.ts
// 受入のテスト(Playwright)は実際の画面を開く(テストだけのルートは作らない)。画面を閉じる門番の規則が閉の間は spec を
// 理由つきで skip する(除外の一覧を持たない: spec が自分の画面を閉じる規則の名前を渡す。例 sampleDomain・demoPages)。
// 読むのはこのリポの規則の値(判定の入口 @/featureGate/ruleList の configEnabled = 規則の enabled() と依存先。全開スイッチは通さない。runner の側で読み、サーバーには聞かない)

import { test } from "@playwright/test";

import type { FeatureName } from "@/featureGate/extensions/rules";
import { configEnabled } from "@/featureGate/ruleList";

/** 規則が閉じていれば、この spec のテストを全部 skip する(理由を出す) */
export function skipWhileClosed(name: FeatureName): void {
  // 未知の名前は configEnabled が throw する
  const open = configEnabled(name);
  const reason = `門番の規則 ${name} が閉じている(この spec の画面は 404)`;
  if (!open) console.log(`[e2e] skip: ${reason}`);
  test.skip(!open, reason);
}
