// useModalSession の検査(jsdom の上で描く)。
// - 初めから開いている = 1 / 閉じている = 0、閉 → 開 の度に 1 増え、開いたまま描き直しても変わらない
// 実行: pnpm test src/hooks/useModalSession.test.ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useModalSession: typeof import("./useModalSession").useModalSession;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useModalSession } = await import("./useModalSession"));
});
after(() => dom.window.close());

test("閉 → 開 の度に 1 増え、開いたままでは変わらない", async () => {
  const seen: number[] = [];
  const Probe = ({ open }: { open: boolean }) => {
    seen.push(useModalSession(open));
    return null;
  };
  const root = createRoot(document.createElement("div"));
  const at = async (open: boolean) => {
    await act(async () => root.render(createElement(Probe, { open })));
    return seen.at(-1);
  };
  assert.equal(await at(false), 0);
  assert.equal(await at(true), 1);
  assert.equal(await at(true), 1);
  assert.equal(await at(false), 1);
  assert.equal(await at(true), 2);
  await act(async () => root.unmount());

  const opened: number[] = [];
  const Open = () => {
    opened.push(useModalSession(true));
    return null;
  };
  const other = createRoot(document.createElement("div"));
  await act(async () => other.render(createElement(Open)));
  assert.equal(opened.at(-1), 1, "初めから開いていれば 1");
  await act(async () => other.unmount());
});
