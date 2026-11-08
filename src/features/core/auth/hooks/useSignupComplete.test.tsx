// useSignupComplete の検査(jsdom の上でフックを動かす。遷移の守りと gtag の送信は偽物、
// コンバージョンの 1 回の守りは本物の useGoogleAdsConversion)。
// - 守りに渡す条件は /signup/register からだけ・失敗はエラー
// - 正当な遷移: StrictMode・再描画でもコンバージョン signup は 1 回 / 不正な遷移・確認中: 0 回
// 実行: pnpm test src/features/core/auth/hooks/useSignupComplete.test.tsx
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

let guard = { isChecking: false, isValidTransition: true };
const guardConfigs: unknown[] = [];
const sent: string[] = [];

mock.module("@/lib/transitionGuard", {
  namedExports: {
    useTransitionGuard: (config: unknown) => {
      guardConfigs.push(config);
      return guard;
    },
  },
});
mock.module("@/lib/googleTag/googleTag", {
  namedExports: {
    GOOGLE_ADS_CONVERSIONS: { signup: "AW-TEST/signup" },
    trackGoogleAdsConversion: ({ sendTo }: { sendTo: string }) => sent.push(sendTo),
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useSignupComplete: typeof import("./useSignupComplete").useSignupComplete;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  const { useGoogleAdsConversion } = await import("@/lib/googleTag");
  mock.module("@/lib/googleTag", { namedExports: { useGoogleAdsConversion } });
  ({ useSignupComplete } = await import("./useSignupComplete"));
});
after(() => dom.window.close());
beforeEach(() => {
  guard = { isChecking: false, isValidTransition: true };
  guardConfigs.length = 0;
  sent.length = 0;
});

let latest: ReturnType<typeof useSignupComplete> | undefined;
const report = (r: ReturnType<typeof useSignupComplete>) => {
  latest = r;
};
const Probe = ({ tick }: { tick: number }) => {
  const r = useSignupComplete();
  useEffect(() => report(r), [r, tick]);
  return null;
};
const view = (tick: number) => createElement(StrictMode, null, createElement(Probe, { tick }));

test("守りの条件: /signup/register からだけ、失敗はエラー。結果をそのまま返す", async () => {
  guard = { isChecking: true, isValidTransition: false };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(view(0)));
  assert.deepEqual(guardConfigs[0], { allowedReferers: ["/signup/register"], onFail: { action: "error" } });
  assert.deepEqual(latest, { isChecking: true, isValidTransition: false });
  await act(async () => root.unmount());
});

test("正当な遷移: StrictMode・再描画でもコンバージョンは 1 回", async () => {
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(view(0)));
  await act(async () => root.render(view(1)));
  await act(async () => root.render(view(2)));
  assert.deepEqual(sent, ["AW-TEST/signup"]);
  await act(async () => root.unmount());
});

test("確認中から正当に変わったら 1 回、不正な遷移では 0 回", async () => {
  guard = { isChecking: true, isValidTransition: false };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(view(0)));
  assert.deepEqual(sent, []);
  guard = { isChecking: false, isValidTransition: false };
  await act(async () => root.render(view(1)));
  assert.deepEqual(sent, []);
  guard = { isChecking: false, isValidTransition: true };
  await act(async () => root.render(view(2)));
  await act(async () => root.render(view(3)));
  assert.deepEqual(sent, ["AW-TEST/signup"]);
  await act(async () => root.unmount());
});
