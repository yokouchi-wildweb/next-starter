// src/lib/analyticsConsent/consent.test.ts
//
// アクセス解析の送信の門の検査（Firebase 不要）。
// 1. 設定と同意の組み合わせ（decideAnalyticsAllowed）
// 2. 同意の状態の購読
// 3. Firebase Analytics は許可が出るまで初期化(initializeAnalytics)せず、page_view / trackEvent を送らない。取り消しで収集を止める
// 4. 初期化は send_page_view: false(gtag の自動の page_view を止め、page_view は <FirebaseAnalytics /> の 1 回だけ)
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
mock.module("@/lib/firebase/client/app", {
  namedExports: { app: {}, isFirebaseClientConfigured: () => true },
});

let consent: typeof import("./consent");
let firebase: typeof import("@/lib/firebase/client/analytics");
let config: typeof import("@/config/app/analytics.config").ANALYTICS_CONFIG;
before(async () => {
  // analytics.ts はブラウザでだけ動く。window と document の最小限を置く
  (globalThis as { window?: unknown }).window = globalThis;
  (globalThis as { document?: unknown }).document = { title: "t" };
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = "G-TEST";
  consent = await import("./consent");
  firebase = await import("@/lib/firebase/client/analytics");
  ({ ANALYTICS_CONFIG: config } = await import("@/config/app/analytics.config"));
});

beforeEach(() => {
  consent.setAnalyticsConsent("unknown");
  config.enabled = false;
  config.consent = "required";
  sdk.events.length = 0;
  sdk.collection.length = 0;
});

test("decideAnalyticsAllowed: 無効なら同意があっても送らない、有効なら同意の扱いに従う", () => {
  const { decideAnalyticsAllowed } = consent;
  for (const c of ["granted", "denied", "unknown"] as const) {
    assert.equal(decideAnalyticsAllowed({ enabled: false, consent: "notRequired" }, c), false);
    assert.equal(decideAnalyticsAllowed({ enabled: false, consent: "required" }, c), false);
    assert.equal(decideAnalyticsAllowed({ enabled: true, consent: "notRequired" }, c), true);
  }
  assert.equal(decideAnalyticsAllowed({ enabled: true, consent: "required" }, "granted"), true);
  assert.equal(decideAnalyticsAllowed({ enabled: true, consent: "required" }, "denied"), false);
  assert.equal(decideAnalyticsAllowed({ enabled: true, consent: "required" }, "unknown"), false);
});

test("既定の設定は無効・同意が必要（ソースの値。実行中の値は beforeEach が書き換える）", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(require.resolve("@/config/app/analytics.config"), "utf8");
  assert.match(source, /enabled: false,/);
  assert.match(source, /consent: "required" as/);
});

test("setAnalyticsConsent は変わったときだけ購読者に知らせ、解除後は知らせない", () => {
  const seen: string[] = [];
  const off = consent.subscribeAnalyticsConsent((c) => seen.push(c));
  consent.setAnalyticsConsent("granted");
  consent.setAnalyticsConsent("granted");
  consent.setAnalyticsConsent("denied");
  off();
  consent.setAnalyticsConsent("granted");
  assert.deepEqual(seen, ["granted", "denied"]);
  assert.equal(consent.getAnalyticsConsent(), "granted");
});

test("無効の間は初期化せず、page_view も trackEvent も送らない", () => {
  consent.setAnalyticsConsent("granted");
  firebase.trackPageView("/a");
  firebase.trackEvent("click");
  assert.equal(firebase.getFirebaseAnalytics(), null);
  assert.equal(sdk.initialized, 0);
  assert.deepEqual(sdk.events, []);
});

test("有効でも同意が出るまで送らず、同意で送り、取り消しで収集を止める", () => {
  config.enabled = true;
  firebase.trackPageView("/a");
  assert.equal(sdk.initialized, 0);
  assert.deepEqual(sdk.events, []);

  consent.setAnalyticsConsent("granted");
  firebase.trackPageView("/a");
  firebase.trackEvent("click");
  assert.equal(sdk.initialized, 1);
  assert.deepEqual(sdk.initOptions, [{ config: { send_page_view: false } }], "初期化で自動の page_view を送らない");
  assert.deepEqual(sdk.events, ["page_view", "click"]);

  consent.setAnalyticsConsent("denied");
  firebase.trackEvent("after-deny");
  assert.deepEqual(sdk.events, ["page_view", "click"]);
  assert.deepEqual(sdk.collection, [false]);
});

test("consent: notRequired なら同意を待たずに送る", () => {
  config.enabled = true;
  config.consent = "notRequired";
  firebase.trackEvent("now");
  assert.ok(sdk.events.includes("now"));
});
