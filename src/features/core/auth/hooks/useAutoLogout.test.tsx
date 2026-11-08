// useAutoLogout の検査(jsdom の上でフックを動かす。useLogout は偽物)。
// - StrictMode で mount の effect が 2 回走っても logout は 1 回
// - 再描画でも増えない・retry で呼び直す・失敗(logout が投げる)でも外へ漏らさない
// 実行: pnpm test src/features/core/auth/hooks/useAutoLogout.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { StrictMode, createElement, useEffect } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

let calls = 0;
let fail = false;
const redirects: string[] = [];
const logout = async () => {
  calls += 1;
  if (fail) throw new Error("logout failed");
};
mock.module("@/features/core/auth/hooks/useLogout", {
  namedExports: {
    useLogout: ({ redirectTo }: { redirectTo: string }) => {
      redirects.push(redirectTo);
      return { logout, isLoading: false, error: null };
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useAutoLogout: typeof import("./useAutoLogout").useAutoLogout;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useAutoLogout } = await import("./useAutoLogout"));
});
after(() => dom.window.close());
beforeEach(() => {
  calls = 0;
  fail = false;
  redirects.length = 0;
});

let latestRetry: (() => void) | undefined;
const Probe = ({ tick }: { tick: number }) => {
  const { retry } = useAutoLogout({ redirectTo: "/login" });
  useEffect(() => {
    latestRetry = retry;
  }, [retry, tick]);
  return null;
};

const mount = async () => {
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(StrictMode, null, createElement(Probe, { tick: 0 }))));
  return root;
};

test("StrictMode の 2 回目の effect でも logout は 1 回、遷移先は useLogout へ渡る", async () => {
  const root = await mount();
  assert.equal(calls, 1);
  assert.ok(redirects.every((r) => r === "/login"));
  await act(async () => root.unmount());
});

test("再描画で増えず、retry で呼び直す", async () => {
  const root = await mount();
  await act(async () => root.render(createElement(StrictMode, null, createElement(Probe, { tick: 1 }))));
  assert.equal(calls, 1);
  await act(async () => latestRetry?.());
  assert.equal(calls, 2);
  await act(async () => root.unmount());
});

test("logout が投げても外へ漏らさない(失敗は useLogout の error に入る)", async () => {
  fail = true;
  const root = await mount();
  assert.equal(calls, 1);
  await act(async () => latestRetry?.());
  assert.equal(calls, 2);
  await act(async () => root.unmount());
});
