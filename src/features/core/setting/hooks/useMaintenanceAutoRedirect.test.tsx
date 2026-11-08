// useMaintenanceAutoRedirect の検査(jsdom の上でフックを動かす。router は偽物、時計は node:test の偽の timer)。
// - 終了時刻が未来: その時刻に 1 回 replace / 過去: 即時 / null: しない / unmount: timer を解く
// 実行: pnpm test src/features/core/setting/hooks/useMaintenanceAutoRedirect.test.tsx
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

const replaced: string[] = [];
const router = { replace: (path: string) => replaced.push(path) };
mock.module("@/lib/unsavedGuard", { namedExports: { useRouter: () => router } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useMaintenanceAutoRedirect: typeof import("./useMaintenanceAutoRedirect").useMaintenanceAutoRedirect;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useMaintenanceAutoRedirect } = await import("./useMaintenanceAutoRedirect"));
});
after(() => dom.window.close());

const NOW = Date.parse("2026-11-08T00:00:00Z");
beforeEach(() => {
  replaced.length = 0;
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: NOW });
});
afterEach(() => mock.timers.reset());

const Probe = ({ endTime }: { endTime: string | null }) => {
  useMaintenanceAutoRedirect({ endTime, redirectTo: "/" });
  return null;
};
const mount = async (endTime: string | null) => {
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe, { endTime })));
  return root;
};

test("終了時刻が未来: その時刻まで待って 1 回 replace", async () => {
  const root = await mount(new Date(NOW + 60_000).toISOString());
  assert.deepEqual(replaced, []);
  mock.timers.tick(59_999);
  assert.deepEqual(replaced, []);
  mock.timers.tick(1);
  assert.deepEqual(replaced, ["/"]);
  await act(async () => root.unmount());
});

test("終了時刻が過去: 即時に replace", async () => {
  const root = await mount(new Date(NOW - 1).toISOString());
  assert.deepEqual(replaced, ["/"]);
  await act(async () => root.unmount());
});

test("終了時刻が null: 何もしない", async () => {
  const root = await mount(null);
  mock.timers.tick(24 * 60 * 60_000);
  assert.deepEqual(replaced, []);
  await act(async () => root.unmount());
});

test("unmount で timer を解く(後から遷移しない)", async () => {
  const root = await mount(new Date(NOW + 60_000).toISOString());
  await act(async () => root.unmount());
  mock.timers.tick(60_000);
  assert.deepEqual(replaced, []);
});
