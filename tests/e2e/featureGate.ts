// tests/e2e/featureGate.ts
// 上流の受入のテスト(Playwright)が開くページは門番の規則で閉じている(e2eFixtures、既定 = 閉、本番では 404)。規則が閉の間は spec を
// 理由つきで skip する(除外の一覧を持たない: spec が自分のページを閉じる規則の名前を渡す)。読むのはこのリポの規則の値
// (生成の一覧 @/featureGate/extensions/rules の enabled()。runner の側で読み、サーバーには聞かない)。
// 開き方: 規則の値を変える(e2eFixtures なら src/config/app/app-features.config.ts の e2e.fixtures = true。コミットしない)

import { test } from "@playwright/test";

import { rules } from "@/featureGate/extensions/rules";
import type { FeatureName } from "@/featureGate/extensions/rules";

/** 規則が閉じていれば、この spec のテストを全部 skip する(理由を出す) */
export function skipWhileClosed(name: FeatureName): void {
  const rule = rules.find((r) => r.name === name);
  if (!rule) throw new Error(`門番の規則 ${name} が無い(src/featureGate/rules/)`);
  const open = rule.enabled();
  const reason = `門番の規則 ${name} が閉じている(受入のページは 404)。開くには規則の値を true にする(手順: tests/e2e/unsavedGuard/README.md)`;
  if (!open) console.log(`[e2e] skip: ${reason}`);
  test.skip(!open, reason);
}
