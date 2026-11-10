// src/lib/frameDims/useFrameDimsStyle.test.ts — pnpm test src/lib/frameDims
import { test } from "node:test";
import assert from "node:assert/strict";

import { frameDimsConfig, frameDimsConfigDef } from "./config";
import { FRAME_OBSERVE_OPTIONS, readFrameDimsStyle, subscribeFrameDims } from "./useFrameDimsStyle";

const frameRoot = { tagName: "DIV" } as unknown as Element;

// 上流の既定(読み込んだ frameDimsConfig は fork が src/config/lib/frameDims.config.ts に書いた値で変わる)。
// readFrameDimsStyle の検査は既定を明示して渡し、subscribe は読み込んだ設定の外枠の印で引く
const defaults = frameDimsConfigDef.compose({});

const lookup = (found: Element | null, rootSelector = defaults.rootSelector) => ({
  querySelector: (selector: string) => (selector === rootSelector ? found : null),
});

const readStyle = (values: Record<string, string>) => (element: Element) => {
  assert.equal(element, frameRoot);
  return { getPropertyValue: (name: string) => values[name] ?? "" };
};

test("外枠が無い時は空", () => {
  assert.deepEqual(readFrameDimsStyle(lookup(null), readStyle({}), defaults), {});
});

test("外枠に書かれた寸法変数の計算値を写す", () => {
  const style = readFrameDimsStyle(
    lookup(frameRoot),
    readStyle({
      "--app-header-height": " 56px",
      "--app-bottom-nav-height": "calc(64px + env(safe-area-inset-bottom, 0px))",
    }),
    defaults,
  );
  assert.deepEqual(style, {
    "--app-header-height": "56px",
    "--app-bottom-nav-height": "calc(64px + env(safe-area-inset-bottom, 0px))",
  });
});

test("隠している間に 0 になった値もそのまま写す", () => {
  const style = readFrameDimsStyle(lookup(frameRoot), readStyle({ "--app-bottom-nav-height": "0px" }), defaults);
  assert.deepEqual(style, { "--app-bottom-nav-height": "0px" });
});

test("既定の設定 = 外枠の印と枠の部位一覧の寸法変数(src/styles/core/frame.css の名前)", () => {
  assert.deepEqual(defaults, {
    rootSelector: "[data-frame-root]",
    vars: {
      header: "--app-header-height",
      "app-banner": "--app-banner-height",
      "bottom-nav": "--app-bottom-nav-height",
    },
  });
});

test("上書きした外枠の印と変数の名前で読む", () => {
  const customRoot = { tagName: "MAIN" } as unknown as Element;
  const style = readFrameDimsStyle(
    { querySelector: (selector: string) => (selector === "#shell" ? customRoot : null) },
    (element) => {
      assert.equal(element, customRoot);
      return { getPropertyValue: (name: string) => ({ "--shell-top": "48px", "--app-header-height": "56px" })[name] ?? "" };
    },
    { rootSelector: "#shell", vars: { header: "--shell-top", "app-banner": "--shell-banner", "bottom-nav": "--shell-bottom" } },
  );
  assert.deepEqual(style, { "--shell-top": "48px" });
});

/** subscribe の環境の偽物: observe の呼び方を記録し、変化を手で起こせる */
function fakeEnv(found: Element | null) {
  const observes: { target: Element; options: MutationObserverInit }[] = [];
  let mutate: (() => void) | null = null;
  const frames: (() => void)[] = [];
  const listeners = new Map<string, () => void>();
  const env = {
    doc: lookup(found, frameDimsConfig.rootSelector),
    win: {
      addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
      requestAnimationFrame: (fn: () => void) => frames.push(fn),
      cancelAnimationFrame: () => {},
    } as never,
    createObserver: (callback: () => void) => {
      mutate = callback;
      return { observe: (target: Element, options?: MutationObserverInit) => observes.push({ target, options: options ?? {} }), disconnect: () => {} };
    },
  };
  return { env, observes, mutate: () => mutate?.(), flush: () => frames.splice(0).forEach((fn) => fn()), listeners };
}

test("外枠を 1 回の observe で属性と子孫の両方を見る(2 回目の observe が 1 回目の指定を置き換えない)", () => {
  const fake = fakeEnv(frameRoot);
  subscribeFrameDims(() => {}, fake.env);
  assert.equal(fake.observes.length, 1);
  assert.equal(fake.observes[0].target, frameRoot);
  assert.deepEqual(fake.observes[0].options, { attributes: true, childList: true, subtree: true });
  assert.deepEqual({ ...FRAME_OBSERVE_OPTIONS }, { attributes: true, childList: true, subtree: true });
});

test("外枠の属性だけの変化(inline の寸法)でも 1 フレームに 1 回読み直す、片付けで resize を外す", () => {
  const fake = fakeEnv(frameRoot);
  let calls = 0;
  const unsubscribe = subscribeFrameDims(() => (calls += 1), fake.env);
  fake.mutate();
  fake.mutate();
  fake.flush();
  assert.equal(calls, 1);
  fake.listeners.get("resize")?.();
  fake.flush();
  assert.equal(calls, 2);
  unsubscribe();
  assert.equal(fake.listeners.has("resize"), false);
});

test("外枠が無い時は observe せず resize だけ見る", () => {
  const fake = fakeEnv(null);
  subscribeFrameDims(() => {}, fake.env);
  assert.equal(fake.observes.length, 0);
  assert.equal(fake.listeners.has("resize"), true);
});
