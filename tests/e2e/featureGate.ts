// tests/e2e/featureGate.ts
// 受入のテスト(Playwright)は実際の画面を開く(テストだけのルートは作らない)。画面を閉じる門番の規則が閉の間は spec を
// 理由つきで skip する(除外の一覧を持たない: spec が自分の画面を閉じる規則の名前を渡す。例 sampleDomain・demoPages)。
// 読むのはサーバーと同じ答え(判定の入口 @/featureGate/ruleList の rules = 規則の値 + 全開スイッチ FEATURE_GATE_OPEN + 依存先。門番の口と同じ一覧。
// @/featureGate/node は .mjs の道具を連れてきて Playwright の読み込みで落ちるので読まない)。runner の側で読み、
// サーバーには聞かない。スイッチの値は playwright.config.default.ts が開発の env(ENV_FILE、既定 .env.development)から読む。
// 上流の開発は FEATURE_GATE_OPEN=all(全部回る)、スイッチが空なら規則の値のまま(fork の既定)

import { test } from "@playwright/test";

import type { FeatureName } from "@/featureGate";
import { ruleEnabled, rules } from "@/featureGate/ruleList";

/** 規則が閉じていれば、この spec のテストを全部 skip する(理由を出す) */
export function skipWhileClosed(name: FeatureName): void {
  const rule = rules.find((r) => r.name === name);
  if (!rule) throw new Error(`e2e: 未知の機能の名前 ${name}(src/featureGate/rules/<名前>.ts)`);
  const open = ruleEnabled(rule);
  const reason = `門番の規則 ${name} が閉じている(この spec の画面は 404)`;
  if (!open) console.log(`[e2e] skip: ${reason}`);
  test.skip(!open, reason);
}
