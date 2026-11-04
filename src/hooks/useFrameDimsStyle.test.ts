// src/hooks/useFrameDimsStyle.test.ts — pnpm test:frame-dims
import { test } from "node:test";
import assert from "node:assert/strict";

import { FRAME_DIM_VARS, readFrameDimsStyle } from "./useFrameDimsStyle";

const frameRoot = { tagName: "DIV" } as unknown as Element;

const lookup = (found: Element | null) => ({
  querySelector: (selector: string) => (selector === "[data-frame-root]" ? found : null),
});

const readStyle = (values: Record<string, string>) => (element: Element) => {
  assert.equal(element, frameRoot);
  return { getPropertyValue: (name: string) => values[name] ?? "" };
};

test("外枠が無い時は空", () => {
  assert.deepEqual(readFrameDimsStyle(lookup(null), readStyle({})), {});
});

test("外枠に書かれた寸法変数の計算値を写す", () => {
  const style = readFrameDimsStyle(
    lookup(frameRoot),
    readStyle({
      "--app-header-height": " 56px",
      "--app-bottom-nav-height": "calc(64px + env(safe-area-inset-bottom, 0px))",
    }),
  );
  assert.deepEqual(style, {
    "--app-header-height": "56px",
    "--app-bottom-nav-height": "calc(64px + env(safe-area-inset-bottom, 0px))",
  });
});

test("隠している間に 0 になった値もそのまま写す", () => {
  const style = readFrameDimsStyle(lookup(frameRoot), readStyle({ "--app-bottom-nav-height": "0px" }));
  assert.deepEqual(style, { "--app-bottom-nav-height": "0px" });
});

test("部位の名前は枠の部位一覧に合わせる", () => {
  assert.deepEqual(Object.keys(FRAME_DIM_VARS), ["header", "banner", "bottom-nav"]);
});
