// useImpressionTracker の検査(useInView の上で、表示されたら対象ごとに 1 回だけ記録する)。
// 実行: pnpm test src/features/core/interactionTracking/hooks/useImpressionTracker.test.tsx(tsx + node:test のモジュールモック + jsdom の上で描画)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
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

/** 手で交差を起こせる IntersectionObserver。生きている(disconnect されていない)ものを数える */
type FakeObserver = { callback: IntersectionObserverCallback; targets: Element[]; options?: IntersectionObserverInit; alive: boolean };
const observers: FakeObserver[] = [];
g.IntersectionObserver = class {
  private readonly self: FakeObserver;
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.self = { callback, targets: [], options, alive: true };
    observers.push(this.self);
  }
  observe(el: Element) {
    this.self.targets.push(el);
  }
  unobserve() {}
  disconnect() {
    this.self.alive = false;
  }
};
const alive = () => observers.filter((o) => o.alive);

const tracked: Array<Record<string, unknown>> = [];
mock.module("../services/client/impressionTracker", {
  namedExports: { trackImpression: (input: Record<string, unknown>) => tracked.push(input) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useImpressionTracker: typeof import("./useImpressionTracker").useImpressionTracker;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useImpressionTracker } = await import("./useImpressionTracker"));
});
after(() => dom.window.close());
beforeEach(() => {
  observers.length = 0;
  tracked.length = 0;
});

type Props = { targetId: string; enabled?: boolean };
const Probe = ({ targetId, enabled }: Props) => {
  const ref = useImpressionTracker({ targetType: "bulletin", targetId, source: "home", enabled });
  return createElement("div", { ref });
};

const mount = async (props: Props) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(Probe, props)));
  return {
    rerender: (next: Props) => act(async () => root.render(createElement(Probe, next))),
    unmount: () => act(async () => root.unmount()),
  };
};

/** 生きている observer に交差の結果を配る */
const intersect = (isIntersecting: boolean) =>
  act(async () => {
    for (const o of alive()) {
      const entries = o.targets.map((target) => ({ isIntersecting, target }) as unknown as IntersectionObserverEntry);
      o.callback(entries, {} as IntersectionObserver);
    }
  });

test("見えたら 1 回だけ記録し、記録した後は監視を外す", async () => {
  const view = await mount({ targetId: "b1" });
  assert.equal(alive().length, 1);
  assert.equal(alive()[0].options?.threshold, 0.5, "既定の交差率 0.5 を useInView に渡す");

  await intersect(false);
  assert.equal(tracked.length, 0, "見えていなければ記録しない");

  await intersect(true);
  assert.deepEqual(tracked, [{ targetType: "bulletin", targetId: "b1", action: undefined, source: "home" }]);
  assert.equal(alive().length, 0, "記録した後は observer が無い");

  await intersect(true);
  assert.equal(tracked.length, 1, "再び交差しても重複しない");
  await view.unmount();
});

test("対象が変わったら監視を付け直し、新しい対象として 1 回記録する", async () => {
  const view = await mount({ targetId: "b1" });
  await intersect(true);
  assert.equal(tracked.length, 1);

  await view.rerender({ targetId: "b2" });
  assert.equal(tracked.length, 1, "前の対象の交差の結果では記録しない");
  assert.equal(alive().length, 1, "新しい対象の監視が付く");
  await intersect(true);
  assert.deepEqual(
    tracked.map((t) => t.targetId),
    ["b1", "b2"],
  );
  assert.equal(alive().length, 0);
  await view.unmount();
});

test("enabled=false なら監視も記録もしない。アンマウントで observer を外す", async () => {
  const off = await mount({ targetId: "b1", enabled: false });
  assert.equal(alive().length, 0);
  await off.unmount();

  const on = await mount({ targetId: "b1" });
  assert.equal(alive().length, 1);
  await on.unmount();
  assert.equal(alive().length, 0, "アンマウントで disconnect される");
  assert.equal(tracked.length, 0);
});

test("画面外へ出た後に対象が変わっても、新しく見えるまで記録しない", async () => {
  const view = await mount({ targetId: "b1" });
  await intersect(true);
  await view.rerender({ targetId: "b2" });
  await intersect(false);
  assert.equal(tracked.length, 1);
  await intersect(true);
  assert.deepEqual(
    tracked.map((t) => t.targetId),
    ["b1", "b2"],
  );
  await view.unmount();
});
