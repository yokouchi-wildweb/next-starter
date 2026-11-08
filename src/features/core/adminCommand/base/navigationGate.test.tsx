// src/features/core/adminCommand/base/navigationGate.test.tsx
// 管理のコマンドパレットの移動の候補の絞り込み(L2.4、jsdom の上で Provider と橋を動かす。Provider の外の認証は未ログイン = 項目を読まない、router は偽物):
// - 管理の枠の GateProvider の内に AdminCommandGateBridge があれば、閉じた機能の住所の行が消える(厳密な gate.path: redirectTo 付きの閉も消える。外部 URL・開は残る、L2.5)
// - 橋の無い所(利用者の画面)では絞らない(navigationFilter = null、throw しない。棚の Link の D14 と同じ)
// - 橋が外れたら絞りも外れる
// 実行: pnpm test:feature-gate:client(--experimental-test-module-mocks)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import type { ReactNode } from "react";
import { JSDOM } from "jsdom";

import type { ClientGateState } from "@/featureGate/client";
import type { NavigationItem } from "@/features/core/adminCommand/types";
import type { AdminCommandContextValue } from "./types";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

// パレットの Provider は useRouter(app router)を読むので偽物にする(移動はこの検査の外)
mock.module("@/lib/unsavedGuard", {
  namedExports: { useRouter: () => ({ push: () => {} }) },
});

type Mod = {
  act: typeof import("react").act;
  createRoot: typeof import("react-dom/client").createRoot;
  AdminCommandProvider: typeof import("./AdminCommandProvider").AdminCommandProvider;
  AdminCommandGateBridge: typeof import("./AdminCommandGateBridge").AdminCommandGateBridge;
  AdminCommandContext: typeof import("./context").AdminCommandContext;
  GateProvider: typeof import("@/featureGate/client").GateProvider;
};
let m: Mod;

before(async () => {
  const react = await import("react");
  const client = await import("react-dom/client");
  const provider = await import("./AdminCommandProvider");
  const bridge = await import("./AdminCommandGateBridge");
  const context = await import("./context");
  const gate = await import("@/featureGate/client");
  m = {
    act: react.act,
    createRoot: client.createRoot,
    AdminCommandProvider: provider.AdminCommandProvider,
    AdminCommandGateBridge: bridge.AdminCommandGateBridge,
    AdminCommandContext: context.AdminCommandContext,
    GateProvider: gate.GateProvider,
  };
});

after(() => dom.window.close());

const ITEMS: NavigationItem[] = [
  { id: "home", label: "top", href: "/admin" },
  { id: "closed", label: "closed", href: "/admin/wallet/history" },
  { id: "redirected", label: "redirected", href: "/signup" },
  { id: "external", label: "external", href: "https://example.com/admin/wallet" },
  { id: "query", label: "query", href: "/admin/wallet?tab=1#x" },
  { id: "protocolRelative", label: "protocolRelative", href: "//example.com/admin/wallet" },
];

const state = (area: ClientGateState["area"]): ClientGateState =>
  ({
    area,
    enabled: {} as ClientGateState["enabled"],
    closed: [
      { pattern: "/admin/wallet", rule: "wallet" },
      { pattern: "/signup", rule: "signup", redirectTo: "/signup-closed" },
    ],
  }) as ClientGateState;

/** Provider の文脈の値を捕まえる */
function render(tree: (probe: ReactNode) => ReactNode) {
  let captured: AdminCommandContextValue | null = null;
  const capture = (value: AdminCommandContextValue | null) => {
    captured = value;
  };
  const { AdminCommandContext, AdminCommandProvider } = m;
  function Probe({ onValue }: { onValue: (value: AdminCommandContextValue | null) => void }) {
    return (
      <AdminCommandContext.Consumer>
        {(value) => {
          onValue(value);
          return null;
        }}
      </AdminCommandContext.Consumer>
    );
  }
  const container = document.createElement("div");
  const root = m.createRoot(container);
  const renderTree = (inner: ReactNode) =>
    m.act(() =>
      root.render(
        <AdminCommandProvider categories={[]} plugins={[]}>
          {inner}
        </AdminCommandProvider>,
      ),
    );
  renderTree(tree(<Probe onValue={capture} />));
  return {
    value: () => captured as AdminCommandContextValue | null,
    rerender: (next: (probe: ReactNode) => ReactNode) => renderTree(next(<Probe onValue={capture} />)),
    unmount: () => m.act(() => root.unmount()),
  };
}

const adminTree = (probe: ReactNode) => (
  <m.GateProvider state={state("admin")}>
    <m.AdminCommandGateBridge />
    {probe}
  </m.GateProvider>
);
const userTree = (probe: ReactNode) => <m.GateProvider state={state("user")}>{probe}</m.GateProvider>;

test("管理の枠の中(橋あり): 閉じた機能の住所の行が消え(redirectTo 付きの閉・? # 付きも)、外部・開いた住所は残る", () => {
  const view = render(adminTree);
  const filter = view.value()?.navigationFilter;
  assert.ok(filter, "橋が絞り込みを登録する");
  assert.deepEqual(filter(ITEMS).map((item) => item.id), ["home", "external", "protocolRelative"]);
  view.unmount();
});

test("管理の枠の外(橋なし): 絞らない(null)。throw しない", () => {
  const view = render(userTree);
  assert.equal(view.value()?.navigationFilter, null);
  view.unmount();
});

test("橋が外れたら絞りも外れる(管理の画面 → 利用者の画面)", () => {
  const view = render(adminTree);
  assert.ok(view.value()?.navigationFilter);
  view.rerender(userTree);
  assert.equal(view.value()?.navigationFilter, null);
  view.unmount();
});
