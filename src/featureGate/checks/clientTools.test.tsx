// src/featureGate/checks/clientTools.test.tsx
// client の受け渡しの回帰テスト(D5・D23): useGate() の enabled・path・filter は、範囲(枠)の中では server の gate と同じ答え。
// 範囲の外の住所・Provider の外は dev(NODE_ENV !== "production")で throw、本番は閉。
// 閉じた状態は一覧の規則の enabled を一時的に差し替えて作り、server が計算する値は clientGateState で作る(config の値に依らない)。
// 実行: pnpm test:feature-gate:client(react-dom/server の静的描画で Provider を通す)

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { clientGateState, gate, type FeatureName, type GatedFeatureRule } from "@/featureGate";
import { GateProvider, useGate, type ClientGate, type ClientGateState } from "@/featureGate/client";
import { rules } from "@/featureGate/node";
import { clientTools } from "@/featureGate/tools/client";
import { matchesPath } from "@/lib/pathPattern/index.mjs";

const env = process.env as Record<string, string | undefined>;
const ORIGINAL_ENV = env.NODE_ENV;
afterEach(() => {
  env.NODE_ENV = ORIGINAL_ENV;
});

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

/** useGate の答えを描画の外へ渡す部品(react-dom/server で 1 回描く) */
function Probe({ onGate }: { onGate: (gate: ClientGate) => void }) {
  onGate(useGate());
  return null;
}

/** Provider の中(state = null なら Provider なし)で useGate を取り出す */
function captureGate(state: ClientGateState | null): ClientGate {
  let captured: ClientGate | undefined;
  const probe = createElement(Probe, { onGate: (gate: ClientGate) => (captured = gate) });
  renderToStaticMarkup(state === null ? probe : <GateProvider state={state}>{probe}</GateProvider>);
  assert.ok(captured);
  return captured;
}

const pathOf = (pattern: string) => pattern.replace(/^=/, "");
const underAdmin = (pathname: string) => matchesPath(pathname, "/admin");
const underApi = (pathname: string) => matchesPath(pathname, "/api");

test("範囲の中: 規則を 1 つずつ閉じ、useGate の enabled・path・filter が server の gate と同じ答え", () => {
  env.NODE_ENV = "development";
  for (const rule of rules) {
    withRules({ [rule.name]: false }, () => {
      const userGate = captureGate(clientGateState("user"));
      const adminGate = captureGate(clientGateState("admin"));
      for (const r of rules) {
        assert.equal(userGate.enabled(r.name), gate.enabled(r.name));
        assert.equal(adminGate.enabled(r.name), gate.enabled(r.name));
      }
      for (const pattern of rule.pathPatterns) {
        const pathname = pathOf(pattern);
        if (underApi(pathname)) continue;
        const items = [{ href: "/" }, { href: pathname }, { href: `${pathname}?q=1#x` }];
        assert.deepEqual(adminGate.path(pathname), gate.path(pathname), `${rule.name} ${pattern}`);
        assert.deepEqual(adminGate.filter(items), gate.filter(items), `${rule.name} ${pattern}`);
        if (underAdmin(pathname)) continue;
        assert.deepEqual(userGate.path(pathname), gate.path(pathname), `${rule.name} ${pattern}`);
        assert.deepEqual(userGate.filter(items), gate.filter(items), `${rule.name} ${pattern}`);
      }
    });
  }
});

test("範囲の外: dev は throw、本番は閉(path は rule: null、filter は除く)。外部 URL と住所の無い項目は残す", () => {
  withRules({}, () => {
    const userGate = captureGate(clientGateState("user"));
    const adminGate = captureGate(clientGateState("admin"));
    env.NODE_ENV = "development";
    assert.throws(() => userGate.path("/admin/users"), /範囲の外/);
    assert.throws(() => adminGate.path("/api/wallet"), /範囲の外/);
    assert.throws(() => userGate.filter([{ href: "/admin" }]), /範囲の外/);
    assert.deepEqual(adminGate.path("/admin/users"), { open: true });
    env.NODE_ENV = "production";
    assert.deepEqual(userGate.path("/admin/users"), { open: false, rule: null });
    const items = [{ href: "/" }, { href: "/admin/users" }, { href: "https://example.com/admin" }, { href: undefined }];
    assert.deepEqual(userGate.filter(items), [items[0], items[2], items[3]]);
  });
});

test("Provider の外: dev は throw、本番は閉(enabled false・path rule: null・filter は内部の住所を除く)", () => {
  const outside = captureGate(null);
  const name = rules[0].name;
  env.NODE_ENV = "development";
  assert.throws(() => outside.enabled(name), /GateProvider の外/);
  assert.throws(() => outside.path("/"), /GateProvider の外/);
  assert.throws(() => outside.filter([{ href: "/" }]), /GateProvider の外/);
  env.NODE_ENV = "production";
  assert.equal(outside.enabled(name), false);
  assert.deepEqual(outside.path("/"), { open: false, rule: null });
  const items = [{ href: "/" }, { href: "https://example.com/" }, { href: undefined }];
  assert.deepEqual(outside.filter(items), [items[1], items[2]]);
});

test("未知の名前は型で落ち、実行時は throw(本番も)", () => {
  withRules({}, () => {
    const userGate = captureGate(clientGateState("user"));
    env.NODE_ENV = "production";
    // @ts-expect-error 規則の無い名前は FeatureName に無い
    assert.throws(() => userGate.enabled("noSuchFeature"), /未知の機能の名前 "noSuchFeature"/);
    assert.throws(() => clientTools.enabled(clientGateState("user"), "constructor" as FeatureName), /未知の機能の名前/);
  });
});

test("getHref: href を持たない型は getHref が必須、順は保つ", () => {
  const wallet = rules.find((r) => r.name === "wallet");
  assert.ok(wallet);
  const closedPath = pathOf(wallet.pathPatterns.find((p) => !underApi(pathOf(p)) && !underAdmin(pathOf(p))) ?? "");
  assert.ok(closedPath);
  withRules({ wallet: false }, () => {
    const userGate = captureGate(clientGateState("user"));
    env.NODE_ENV = "development";
    const rows = [{ to: "/" }, { to: closedPath }, { to: "/x" }];
    assert.deepEqual(userGate.filter(rows, (row) => row.to), [rows[0], rows[2]]);
    // @ts-expect-error href を持たない型は getHref が必須
    userGate.filter(rows);
  });
});
