// src/featureGate/checks/clientTools.test.tsx
// client の受け渡しの回帰テスト(D5・D23): useGate() の enabled・path・filter は、範囲(枠)の中では server の gate と同じ答え。
// 範囲の外の住所・Provider の外は dev(段階が development、@/lib/appEnv)で throw、本番は閉。
// 閉じた状態は一覧の規則の enabled を一時的に差し替えて作り、server が計算する値は clientGateState で作る(config の値に依らない)。
// リンク: 棚の Link・LinkButton・GatedLink は「'/' で始まる内部の住所で、枠の中の redirectTo の無い閉」だけを描かない(D14)。
// 枠の外・Provider の外・外部 URL・redirectTo 付きの閉は描く(throw しない)。server component(フックを持たない関数部品)の中から描いても同じ(L1.8)。
// 実行: pnpm test src/featureGate/checks/clientTools.test.tsx(react-dom/server の静的描画で Provider を通す)

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { clientGateState, gate, type FeatureName, type GatedFeatureRule, type GeneratedFeatureRule } from "@/featureGate";
import { rules as generatedRules } from "@/featureGate/extensions/rules";
import { overrideSwitches } from "@/featureGate/ruleList";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Link, LinkVisibilityProvider } from "@/components/Navigation";
import { RichMenuCard } from "@/features/core/user/components/common/RichMenuCard";
import { GatedLink, GateProvider, useGate, type ClientGate, type ClientGateState } from "@/featureGate/client";
import { rules } from "@/featureGate/node";
import { clientTools } from "@/featureGate/tools/client";
import { setAppEnv, type AppEnv } from "@/lib/appEnv";
import { matchesPath } from "@/lib/pathPattern/index.mjs";

// 段階の差し替え(@/lib/appEnv)。各テストの後に差し替える前へ戻す
const restores: Array<() => void> = [];
const stage = (value: AppEnv) => {
  restores.push(setAppEnv(value));
};
afterEach(() => {
  while (restores.length > 0) restores.pop()?.();
});

function withRules(states: Partial<Record<FeatureName, boolean>>, fn: () => void) {
  // 生成一覧の規則の値(自分の値)を差し替える: 判定は依存先(dependsOn)まで解くので、親を閉じれば子も閉じる
  const saved = new Map<GeneratedFeatureRule, GeneratedFeatureRule["enabled"]>();
  const savedDefaults = new Map<GeneratedFeatureRule, boolean | undefined>();
  // fork の switches.config.ts の値も外す(規則の値を作り物だけで決める)
  const restoreSwitches = overrideSwitches();
  for (const rule of generatedRules) {
    saved.set(rule, rule.enabled);
    // 入切の既定(defaultEnabled)も外し、開閉は enabled の差し替えだけで決める
    savedDefaults.set(rule, rule.defaultEnabled);
    rule.defaultEnabled = undefined;
    const state = states[rule.name];
    rule.enabled = () => state ?? true;
  }
  try {
    fn();
  } finally {
    for (const [rule, enabled] of saved) rule.enabled = enabled;
    for (const [rule, value] of savedDefaults) rule.defaultEnabled = value;
    restoreSwitches();
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
  stage("development");
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
    stage("development");
    assert.throws(() => userGate.path("/admin/users"), /範囲の外/);
    assert.throws(() => adminGate.path("/api/wallet"), /範囲の外/);
    assert.throws(() => userGate.filter([{ href: "/admin" }]), /範囲の外/);
    assert.deepEqual(adminGate.path("/admin/users"), { open: true });
    stage("production");
    assert.deepEqual(userGate.path("/admin/users"), { open: false, rule: null });
    const items = [{ href: "/" }, { href: "/admin/users" }, { href: "https://example.com/admin" }, { href: undefined }];
    assert.deepEqual(userGate.filter(items), [items[0], items[2], items[3]]);
  });
});

test("Provider の外: dev は throw、本番は閉(enabled false・path rule: null・filter は内部の住所を除く)", () => {
  const outside = captureGate(null);
  const name = rules[0].name;
  stage("development");
  assert.throws(() => outside.enabled(name), /GateProvider の外/);
  assert.throws(() => outside.path("/"), /GateProvider の外/);
  assert.throws(() => outside.filter([{ href: "/" }]), /GateProvider の外/);
  stage("production");
  assert.equal(outside.enabled(name), false);
  assert.deepEqual(outside.path("/"), { open: false, rule: null });
  const items = [{ href: "/" }, { href: "https://example.com/" }, { href: undefined }];
  assert.deepEqual(outside.filter(items), [items[1], items[2]]);
});

test("未知の名前は型で落ち、実行時は throw(本番も)", () => {
  withRules({}, () => {
    const userGate = captureGate(clientGateState("user"));
    stage("production");
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
    stage("development");
    const rows = [{ to: "/" }, { to: closedPath }, { to: "/x" }];
    assert.deepEqual(userGate.filter(rows, (row) => row.to), [rows[0], rows[2]]);
    // @ts-expect-error href を持たない型は getHref が必須
    userGate.filter(rows);
  });
});

/** href を指す a が HTML にあるか */
const hasAnchor = (html: string, href: string) => html.includes(`href="${href.replace(/&/g, "&amp;")}"`);

const renderIn = (state: ClientGateState | null, node: React.ReactNode) =>
  renderToStaticMarkup(state === null ? <>{node}</> : <GateProvider state={state}>{node}</GateProvider>);

/** server component の形(フックを持たず 'use client' でもない関数部品)の中から棚の Link・LinkButton・GatedLink を描く */
function ServerLinks({ href }: { href: string }) {
  return (
    <nav>
      <Link href={href}>link</Link>
      <LinkButton href={href}>button</LinkButton>
      <GatedLink href={href}>gated</GatedLink>
    </nav>
  );
}

test("リンク: 規則を 1 つずつ閉じ、枠の中の redirectTo の無い閉だけを描かない(Link・LinkButton・GatedLink・server component の中)", () => {
  for (const rule of rules) {
    withRules({ [rule.name]: false }, () => {
      for (const area of ["user", "admin"] as const) {
        const state = clientGateState(area);
        for (const pattern of rule.pathPatterns) {
          const pathname = pathOf(pattern);
          if (underApi(pathname)) continue;
          const inArea = area === "admin" || !underAdmin(pathname);
          const hidden = inArea && rule.redirectTo === undefined;
          const label = `${rule.name} ${pattern} ${area}`;
          for (const node of [
            <Link key="l" href={pathname}>x</Link>,
            <LinkButton key="b" href={pathname}>x</LinkButton>,
            <GatedLink key="g" href={pathname}>x</GatedLink>,
            <Link key="q" href={`${pathname}?q=1#x`}>x</Link>,
            <Link key="u" href={{ pathname }}>x</Link>,
          ]) {
            assert.equal(renderIn(state, node).includes("<a "), !hidden, label);
          }
          const html = renderIn(state, <ServerLinks href={pathname} />);
          assert.equal((html.match(/<a /g) ?? []).length, hidden ? 0 : 3, `server component ${label}`);
          // 開いた住所と外部 URL は描く
          assert.ok(hasAnchor(renderIn(state, <ServerLinks href="/__open__" />), "/__open__"));
          assert.ok(hasAnchor(renderIn(state, <Link href={`https://example.com${pathname}`}>x</Link>), `https://example.com${pathname}`));
        }
      }
    });
  }
});

test("リンク: gate prop(always は閉でも描く・hide は描かない)、Provider の外は描く、GatedLink は棚の口の差し込みに依らない", () => {
  const wallet = rules.find((r) => r.name === "wallet");
  assert.ok(wallet);
  const closedPath = pathOf(wallet.pathPatterns.find((p) => !underApi(pathOf(p)) && !underAdmin(pathOf(p))) ?? "");
  withRules({ wallet: false }, () => {
    const state = clientGateState("user");
    stage("development");
    assert.ok(hasAnchor(renderIn(state, <Link href={closedPath} gate="always">x</Link>), closedPath));
    assert.ok(hasAnchor(renderIn(state, <LinkButton href={closedPath} gate="always">x</LinkButton>), closedPath));
    assert.equal(renderIn(state, <Link href="/__open__" gate="hide">x</Link>), "");
    assert.equal(renderIn(null, <Link href="/__open__" gate="hide">x</Link>), "");
    // Provider の外・枠の外は描く(throw しない)
    assert.equal((renderIn(null, <ServerLinks href={closedPath} />).match(/<a /g) ?? []).length, 3);
    assert.ok(hasAnchor(renderIn(state, <Link href="/admin/users">x</Link>), "/admin/users"));
    // 棚の口を「何も隠さない」で包み直しても、GatedLink は門番の判定で隠す(棚の Link は包み直しに従う)
    const reopened = (node: React.ReactNode) => <LinkVisibilityProvider isHidden={() => false}>{node}</LinkVisibilityProvider>;
    assert.equal(renderIn(state, reopened(<GatedLink href={closedPath}>x</GatedLink>)), "");
    assert.ok(hasAnchor(renderIn(state, reopened(<Link href={closedPath}>x</Link>)), closedPath));
  });
});

test("棚の Link は門番なしでは何も隠さない(既定の口)", () => {
  assert.ok(hasAnchor(renderToStaticMarkup(<Link href="/wallet">x</Link>), "/wallet"));
});

test("マイページのメニュー: 条件を外した RichMenuCard は、閉じた規則(referral・mypageOther・pause・withdraw)の住所ならカードごと描かない", () => {
  const cards: Array<[FeatureName, string]> = [
    ["referral", "/mypage/invite"],
    ["mypageOther", "/mypage/other"],
    ["pause", "/mypage/pause"],
    ["withdraw", "/mypage/withdraw"],
  ];
  const Icon = () => null;
  for (const [name, href] of cards) {
    const card = <RichMenuCard icon={Icon as never} title="t" description="d" href={href} showChevron />;
    withRules({ [name]: false }, () => {
      assert.equal(renderIn(clientGateState("user"), card), "", `${name} 閉`);
    });
    withRules({}, () => {
      assert.ok(hasAnchor(renderIn(clientGateState("user"), card), href), `${name} 開`);
    });
  }
});
