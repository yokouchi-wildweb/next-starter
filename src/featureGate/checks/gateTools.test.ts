// src/featureGate/checks/gateTools.test.ts
// gate の束の道具の回帰テスト(D23): gate.enabled は規則名で引けて規則の enabled() を返し、未知の名前は型で落ち実行時は throw。
// gate.path は一覧の順で最初の閉じた規則を返す。gate.assert は閉なら 404 の DomainError(機能名を出さない)。
// gate.filter は '/' で始まる内部の住所で redirectTo の無い閉じた規則に当たる項目だけを除く(判定 hiddenHref.ts)。
// 閉じた状態は一覧の規則の enabled を一時的に差し替えて作る(config の値に依らない)。
// 型の検査は pnpm typecheck(@ts-expect-error の行)、実行は pnpm test:feature-gate:tools

import assert from "node:assert/strict";
import { test } from "node:test";

import { gate, type FeatureGateRule, type FeatureName, type GatedFeatureRule } from "@/featureGate";
import { isHiddenHref } from "@/featureGate/hiddenHref";
import { isDomainError } from "@/lib/errors";
import type { FeatureGateRule as LegacyFeatureGateRule } from "@/proxies/types";
import { rules } from "@/featureGate/node";
import { matchesPath } from "@/lib/pathPattern/index.mjs";

test("gate.enabled: 規則のファイル名で引け、規則の enabled() の答えを返す", () => {
  assert.ok(rules.length > 0);
  for (const rule of rules) assert.equal(gate.enabled(rule.name), rule.enabled());
  const wallet: FeatureName = "wallet";
  assert.equal(typeof gate.enabled(wallet), "boolean");
});

// 旧い場所の型(非推奨の再 export)は同じ型のまま残る(次の区切りで消す)
const legacyRule: LegacyFeatureGateRule = { pathPatterns: ["/x"], enabled: () => true } satisfies FeatureGateRule;

test("旧い場所の型 @/proxies/types の FeatureGateRule は @/featureGate と同じ型", () => {
  assert.equal(legacyRule.enabled(), true);
});

test("gate.enabled: 未知の名前は型で落ち、実行時は throw", () => {
  // @ts-expect-error 規則の無い名前は FeatureName に無い
  assert.throws(() => gate.enabled("noSuchFeature"), /未知の機能の名前 "noSuchFeature"/);
  assert.throws(() => gate.enabled("constructor" as FeatureName), /未知の機能の名前/);
});

test("gate.path: 閉じた規則の住所なら一覧の順で最初の閉じた規則の名前と redirectTo、開いていれば open:true", () => {
  for (const rule of rules.filter((r) => !r.enabled())) {
    for (const pattern of rule.pathPatterns) {
      const pathname = pattern.replace(/^=/, "");
      const first = rules.find((r) => !r.enabled() && r.pathPatterns.some((p) => matchesPath(pathname, p)));
      assert.deepEqual(gate.path(pathname), { open: false, rule: first?.name, redirectTo: first?.redirectTo });
    }
  }
  assert.deepEqual(gate.path("/__no_such_gated_path__"), { open: true });
});

/** 規則の enabled を一時的に差し替えて fn を走らせる(終われば戻す) */
function withRules(states: Partial<Record<FeatureName, boolean>>, fn: () => void) {
  const saved = new Map<GatedFeatureRule, GatedFeatureRule["enabled"]>();
  for (const rule of rules) {
    saved.set(rule, rule.enabled);
    const state = states[rule.name];
    rule.enabled = () => state ?? true;
  }
  try {
    fn();
  } finally {
    for (const [rule, enabled] of saved) rule.enabled = enabled;
  }
}

const ruleOf = (name: FeatureName) => {
  const rule = rules.find((r) => r.name === name);
  assert.ok(rule, `規則 ${name} が無い`);
  return rule;
};

test("gate.assert: 開なら何もせず、閉なら 404 の DomainError(決まった文言、機能名・code・details なし)", () => {
  for (const rule of rules) {
    withRules({}, () => assert.doesNotThrow(() => gate.assert(rule.name)));
    withRules({ [rule.name]: false }, () => {
      let caught: unknown;
      try {
        gate.assert(rule.name);
      } catch (error) {
        caught = error;
      }
      assert.ok(isDomainError(caught), `${rule.name}: DomainError でない`);
      assert.equal(caught.status, 404);
      assert.equal(caught.message, "お探しのページは見つかりませんでした");
      assert.equal(caught.code, undefined);
      assert.equal(caught.details, undefined);
      assert.ok(!caught.message.includes(rule.name));
    });
  }
});

test("gate.assert: 未知の名前は型で落ち、実行時は throw", () => {
  // @ts-expect-error 規則の無い名前は FeatureName に無い
  assert.throws(() => gate.assert("noSuchFeature"), /未知の機能の名前 "noSuchFeature"/);
});

test("gate.filter: 規則を 1 つずつ閉じ、その住所の項目だけが除かれる(redirectTo 付きは残す)", () => {
  for (const rule of rules) {
    withRules({ [rule.name]: false }, () => {
      for (const pattern of rule.pathPatterns) {
        const pathname = pattern.replace(/^=/, "");
        const items = [{ href: "/__open_before__" }, { href: pathname }, { href: `${pathname}?q=1#x` }, { href: "/__open_after__" }];
        const expected = rule.redirectTo === undefined ? [items[0], items[3]] : items;
        assert.deepEqual(gate.filter(items), expected, `${rule.name} ${pattern}`);
      }
    });
  }
});

test("gate.filter: 内部の住所だけを見る・href の無い項目は残す・getHref で引ける・順を保つ", () => {
  const wallet = ruleOf("wallet");
  const closedPath = wallet.pathPatterns[0].replace(/^=/, "");
  withRules({ wallet: false }, () => {
    const items = [
      { href: `https://example.com${closedPath}` },
      { href: `//example.com${closedPath}` },
      { href: undefined },
      { href: null },
      { href: closedPath },
      { href: "/" },
    ];
    assert.deepEqual(gate.filter(items), [items[0], items[1], items[2], items[3], items[5]]);
    const rows = [{ to: "/" }, { to: closedPath }, { to: "" }];
    assert.deepEqual(
      gate.filter(rows, (row) => row.to || undefined),
      [rows[0], rows[2]],
    );
    // @ts-expect-error href を持たない型は getHref が必須
    gate.filter(rows);
  });
  withRules({}, () => {
    const items = [{ href: closedPath }];
    const result = gate.filter(items);
    assert.deepEqual(result, items);
    assert.notEqual(result, items, "新しい配列を返す");
  });
});

test("isHiddenHref: 並びの順で最初に当たった閉じた住所の redirectTo で決まる", () => {
  const closed = [{ pattern: "/a", redirectTo: "/a-closed" }, { pattern: "/a/b" }];
  assert.equal(isHiddenHref("/a/b", closed), false);
  assert.equal(isHiddenHref("/a/b", [...closed].reverse()), true);
  assert.equal(isHiddenHref("/x", closed), false);
  assert.equal(isHiddenHref("a/b", [{ pattern: "/a" }]), false);
});
