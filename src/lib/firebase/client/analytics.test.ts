// src/lib/firebase/client/analytics.test.ts
//
// Firebase Analytics が送信の門(@/lib/analyticsConsent)に従うことの検査(Firebase 不要)。
// 門の判定そのもの(設定 × 同意)は src/lib/analyticsConsent/consent.test.ts。ここでは門の入口を偽物に差し替え、答えだけを決める。
// 1. 送ってよくない間は初期化(initializeAnalytics)せず、page_view / trackEvent を送らない
// 2. 許可で初期化して送り、取り消しで収集を止める
// 3. 初期化は send_page_view: false(gtag の自動の page_view を止め、page_view は <FirebaseAnalytics /> の 1 回だけ)
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const sdk = {
  initialized: 0,
  initOptions: [] as unknown[],
  events: [] as string[],
  collection: [] as boolean[],
};
mock.module(pathToFileURL(require.resolve("firebase/analytics")).href, {
  namedExports: {
    initializeAnalytics: (_app: unknown, options: unknown) => {
      sdk.initialized += 1;
      sdk.initOptions.push(options);
      return { app: "mock" };
    },
    logEvent: (_instance: unknown, name: string) => void sdk.events.push(name),
    setAnalyticsCollectionEnabled: (_instance: unknown, enabled: boolean) => void sdk.collection.push(enabled),
  },
});
mock.module("./app", {
  namedExports: { app: {}, isFirebaseClientConfigured: () => true },
});

/** 門の偽物: allowed が答え、setAllowed で購読者に知らせる */
const gate = {
  allowed: false,
  listeners: new Set<() => void>(),
  setAllowed(next: boolean) {
    gate.allowed = next;
    for (const listener of gate.listeners) listener();
  },
};
mock.module("@/lib/analyticsConsent", {
  namedExports: {
    isAnalyticsAllowed: () => gate.allowed,
    subscribeAnalyticsConsent: (listener: () => void) => {
      gate.listeners.add(listener);
      return () => gate.listeners.delete(listener);
    },
  },
});

let firebase: typeof import("./analytics");
before(async () => {
  // analytics.ts はブラウザでだけ動く。window と document の最小限を置く
  (globalThis as { window?: unknown }).window = globalThis;
  (globalThis as { document?: unknown }).document = { title: "t" };
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = "G-TEST";
  firebase = await import("./analytics");
});

beforeEach(() => {
  gate.allowed = false;
  sdk.events.length = 0;
  sdk.collection.length = 0;
});

test("送ってよくない間は初期化せず、page_view も trackEvent も送らない", () => {
  firebase.trackPageView("/a");
  firebase.trackEvent("click");
  assert.equal(firebase.getFirebaseAnalytics(), null);
  assert.equal(sdk.initialized, 0);
  assert.deepEqual(sdk.events, []);
});

test("許可で初期化して送り、取り消しで収集を止め、再び許可で戻す", () => {
  gate.setAllowed(true);
  firebase.trackPageView("/a");
  firebase.trackEvent("click");
  assert.equal(sdk.initialized, 1);
  assert.deepEqual(sdk.initOptions, [{ config: { send_page_view: false } }], "初期化で自動の page_view を送らない");
  assert.deepEqual(sdk.events, ["page_view", "click"]);

  gate.setAllowed(false);
  firebase.trackEvent("after-deny");
  assert.deepEqual(sdk.events, ["page_view", "click"]);
  assert.deepEqual(sdk.collection, [false]);

  gate.setAllowed(true);
  firebase.trackEvent("again");
  assert.equal(sdk.initialized, 1, "初期化は 1 回だけ");
  assert.deepEqual(sdk.collection, [false, true]);
  assert.ok(sdk.events.includes("again"));
});
