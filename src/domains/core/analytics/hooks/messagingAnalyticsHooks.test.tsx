// 連絡の集計の hook の検査(jsdom の上で描く。client service は偽物)。
// - useMessagingAnalyticsSummary / Series: 期間と絞りを渡す、params が変われば取り直す、enabled: false は取らない
// - useMessagingAnalyticsBreakdown: axis と params を渡す、axis null は取らない
// - useMessagingAnalyticsDispatches: 先頭は cursor なし、続きは前の nextCursor、null で終端。dispatchesEnabled / trackingEnabled を返す
// - useMessagingAnalyticsDispatchReads: dispatchIds だけを渡す(期間・cursor なし)、空の一覧は取らない、順と重なりの違う同じ組は取り直さない、id → 行、100 件を超える組は 100 件ずつ
// 実行: pnpm test src/domains/core/analytics/hooks/messagingAnalyticsHooks.test.tsx
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
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const calls: { name: string; args: unknown[] }[] = [];
const row = (dispatchId: string) => ({ dispatchId, tags: [] });
mock.module("@/domains/core/analytics/services/client/messagingAnalyticsClient", {
  namedExports: {
    fetchMessagingSummary: async (params: unknown) => {
      calls.push({ name: "summary", args: [params] });
      return { metrics: { sent: 3 } };
    },
    fetchMessagingSeries: async (params: unknown) => {
      calls.push({ name: "series", args: [params] });
      return { history: [] };
    },
    fetchMessagingBreakdown: async (axis: unknown, params: unknown) => {
      calls.push({ name: "breakdown", args: [axis, params] });
      return { axis, entries: [] };
    },
    fetchMessagingDispatches: async (params: Record<string, unknown>) => {
      calls.push({ name: "dispatches", args: [params] });
      if (params.dispatchIds) {
        // 予約の送信 "s" は集計に入らない
        const ids = (params.dispatchIds as string[]).filter((id) => id !== "s");
        return { items: ids.map(row), nextCursor: null, dispatchesEnabled: true, trackingEnabled: true };
      }
      if (!params.cursor) {
        return { items: [row("a"), row("b")], nextCursor: "cur-b", dispatchesEnabled: true, trackingEnabled: false };
      }
      return { items: [row("c")], nextCursor: null, dispatchesEnabled: true, trackingEnabled: false };
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SWRConfig: typeof import("swr").SWRConfig;
let summaryHook: typeof import("./useMessagingAnalyticsSummary");
let seriesHook: typeof import("./useMessagingAnalyticsSeries");
let breakdownHook: typeof import("./useMessagingAnalyticsBreakdown");
let dispatchesHook: typeof import("./useMessagingAnalyticsDispatches");
let readsHook: typeof import("./useMessagingAnalyticsDispatchReads");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  summaryHook = await import("./useMessagingAnalyticsSummary");
  seriesHook = await import("./useMessagingAnalyticsSeries");
  breakdownHook = await import("./useMessagingAnalyticsBreakdown");
  dispatchesHook = await import("./useMessagingAnalyticsDispatches");
  readsHook = await import("./useMessagingAnalyticsDispatchReads");
});
after(() => dom.window.close());
beforeEach(() => {
  calls.length = 0;
});

const mount = async <P, T>(useHook: (props: P) => T, initial: P) => {
  const latest: { current: T | null } = { current: null };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const Probe = ({ props, report }: { props: P; report: (value: T) => void }) => {
    report(useHook(props));
    return null;
  };
  const cache = new Map();
  const render = async (props: P) => {
    await act(async () => {
      root.render(
        createElement(
          SWRConfig,
          { value: { provider: () => cache, dedupingInterval: 0 } },
          createElement(Probe, { props, report: (value: T) => (latest.current = value) }),
        ),
      );
    });
    // SWR の取得が終わるまで待つ(SWR は描く間に読んだ値だけ見張るので、hook の data は描く間に読む)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  };
  await render(initial);
  return { value: () => latest.current!, rerender: render, unmount: () => act(async () => root.unmount()) };
};

test("summary: 期間と絞りを渡し、params が変われば取り直す", async () => {
  const view = await mount(
    (p: { days: number }) => ({
      data: summaryHook.useMessagingAnalyticsSummary({ days: p.days, channel: "email" }).data,
    }),
    {
      days: 7,
    },
  );
  assert.deepEqual(view.value().data, { metrics: { sent: 3 } });
  await view.rerender({ days: 30 });
  assert.deepEqual(
    calls.map((c) => c.args[0]),
    [
      { days: 7, channel: "email" },
      { days: 30, channel: "email" },
    ],
  );
  await view.unmount();
});

test("series: params を渡す / enabled: false は取らない", async () => {
  const view = await mount(() => seriesHook.useMessagingAnalyticsSeries({ granularity: "week" }), null);
  const off = await mount(
    () => ({ data: summaryHook.useMessagingAnalyticsSummary({}, { enabled: false }).data }),
    null,
  );
  assert.deepEqual(calls, [{ name: "series", args: [{ granularity: "week" }] }]);
  assert.equal(off.value().data, undefined);
  await view.unmount();
  await off.unmount();
});

test("breakdown: axis と params を渡す、axis null は取らない", async () => {
  const view = await mount(
    (p: { axis: "channel" | null }) => ({
      data: breakdownHook.useMessagingAnalyticsBreakdown(p.axis, { category: "marketing" }).data,
    }),
    { axis: null } as { axis: "channel" | null },
  );
  assert.equal(calls.length, 0);
  await view.rerender({ axis: "channel" });
  assert.deepEqual(calls, [{ name: "breakdown", args: ["channel", { category: "marketing" }] }]);
  assert.deepEqual(view.value().data, { axis: "channel", entries: [] });
  await view.unmount();
});

test("dispatches: 先頭は cursor なし → 続きは nextCursor → null で終端、旗を返す", async () => {
  const view = await mount(
    () =>
      dispatchesHook.useMessagingAnalyticsDispatches({
        params: { days: 30, messageKey: "messaging.adminMarketing" },
        limit: 2,
      }),
    null,
  );
  assert.deepEqual(
    view.value().items.map((i) => i.dispatchId),
    ["a", "b"],
  );
  assert.equal(view.value().dispatchesEnabled, true);
  assert.equal(view.value().trackingEnabled, false);
  await act(async () => view.value().loadMore());
  assert.deepEqual(
    view.value().items.map((i) => i.dispatchId),
    ["a", "b", "c"],
  );
  assert.equal(view.value().hasMore, false);
  const params = calls.map((c) => c.args[0] as Record<string, unknown>);
  assert.equal(params[0].cursor, null);
  assert.equal(params[0].days, 30);
  assert.equal(params[0].messageKey, "messaging.adminMarketing");
  assert.equal(params[0].limit, 2);
  assert.equal(params[1].cursor, "cur-b");
  await view.unmount();
});

test("dispatch reads: 100 件を超える組は 100 件ずつ(並べた順)に分けて取り、1 つにまとめる", async () => {
  const ids = Array.from({ length: 150 }, (_, index) => `d${String(index).padStart(3, "0")}`);
  const view = await mount((list: string[]) => readsHook.useMessagingAnalyticsDispatchReads(list), ids.slice().reverse());
  const requests = calls.filter((c) => c.name === "dispatches").map((c) => (c.args[0] as { dispatchIds: string[] }).dispatchIds);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], ids.slice(0, 100));
  assert.deepEqual(requests[1], ids.slice(100));
  assert.equal(view.value().rows.size, 150);
  assert.deepEqual(readsHook.dispatchReadChunks(ids).map((chunk) => chunk.length), [100, 50]);
  await view.unmount();
});

test("dispatch reads: dispatchIds だけを渡し id → 行、空は取らない、同じ組は取り直さない", async () => {
  const view = await mount((ids: string[]) => readsHook.useMessagingAnalyticsDispatchReads(ids), [] as string[]);
  assert.equal(calls.length, 0);
  assert.equal(view.value().rows.size, 0);
  await view.rerender(["b", "a", "s", "a"]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.args[0], { dispatchIds: ["a", "b", "s"] });
  assert.deepEqual([...view.value().rows.keys()].sort(), ["a", "b"]);
  assert.equal(view.value().rows.get("s"), undefined);
  assert.equal(view.value().dispatchesEnabled, true);
  await view.rerender(["s", "b", "a"]);
  assert.equal(calls.length, 1);
  await view.unmount();
});
