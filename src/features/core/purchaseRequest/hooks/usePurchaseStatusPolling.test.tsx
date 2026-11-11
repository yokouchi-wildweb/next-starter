// usePurchaseStatusPolling の検査(jsdom の上でフックを動かす。状態の取得・router・タイマーは偽物):
// 既定のパス(/wallet/<slug>/purchase/...)と指定のパス(completePath / failedPath)で、
// completed → 完了へ、failed → error_code(無ければ UNKNOWN)、expired → reason=expired、30 回 pending → reason=timeout。
// 行き先を両方渡すときは slug を省ける(片方だけで slug 無しが型の誤りなのは隣の .test.ts。同じ名前の .ts があるとこの .tsx は tsc が読まない)
// 実行: pnpm test src/features/core/purchaseRequest/hooks/usePurchaseStatusPolling.test.tsx
// (tsx + node:test のモジュールモック + jsdom。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { JSDOM } from "jsdom";

import type { UsePurchaseStatusPollingParams } from "./usePurchaseStatusPolling";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

// 状態の取得: 呼ばれるたびに次の結果を使う(尽きたら pending)
let statuses: Array<{ status: string; errorCode?: string | null }> = [];
let fetches = 0;
const replaced: string[] = [];
const router = { replace: (url: string) => replaced.push(url) };

mock.module(pathToFileURL(require.resolve("../services/client/purchaseRequestClient")).href, {
  namedExports: {
    getPurchaseStatus: async () => {
      fetches += 1;
      return statuses.shift() ?? { status: "pending" };
    },
  },
});
mock.module("@/lib/unsavedGuard", { namedExports: { useRouter: () => router } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let usePurchaseStatusPolling: typeof import("./usePurchaseStatusPolling").usePurchaseStatusPolling;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ usePurchaseStatusPolling } = await import("./usePurchaseStatusPolling"));
});
after(() => dom.window.close());
beforeEach(() => {
  statuses = [];
  fetches = 0;
  replaced.length = 0;
  mock.timers.enable({ apis: ["setTimeout"] });
});
afterEach(() => mock.timers.reset());

type Paths = { completePath?: string; failedPath?: string };

/** フックを描き、最初の取得まで進める(params を渡すとそのまま使う: slug 無しの形) */
async function mount(paths: Paths = {}, params?: UsePurchaseStatusPollingParams) {
  function Probe() {
    usePurchaseStatusPolling(params ?? { requestId: "r1", slug: "coin", ...paths });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  return () => act(async () => root.unmount());
}

/** 次の 2 秒の取得まで進める */
const nextPoll = () =>
  act(async () => {
    mock.timers.tick(2000);
    await Promise.resolve();
  });

const own: Paths = { completePath: "/direct-sale/purchase/complete", failedPath: "/direct-sale/purchase/failed" };

for (const [name, paths, base] of [
  ["既定のパス", {}, "/wallet/coin/purchase"],
  ["指定のパス", own, "/direct-sale/purchase"],
] as const) {
  test(`${name}: completed → 完了へ request_id を付けて移る`, async () => {
    statuses = [{ status: "pending" }, { status: "completed" }];
    const unmount = await mount(paths);
    assert.deepEqual(replaced, []);
    await nextPoll();
    assert.deepEqual(replaced, [`${base}/complete?request_id=r1`]);
    await unmount();
  });

  test(`${name}: failed → error_code(無ければ UNKNOWN)`, async () => {
    statuses = [{ status: "failed", errorCode: "CARD_DECLINED" }];
    let unmount = await mount(paths);
    assert.deepEqual(replaced, [`${base}/failed?request_id=r1&error_code=CARD_DECLINED`]);
    await unmount();
    replaced.length = 0;
    statuses = [{ status: "failed", errorCode: null }];
    unmount = await mount(paths);
    assert.deepEqual(replaced, [`${base}/failed?request_id=r1&error_code=UNKNOWN`]);
    await unmount();
  });

  test(`${name}: expired → reason=expired`, async () => {
    statuses = [{ status: "expired" }];
    const unmount = await mount(paths);
    assert.deepEqual(replaced, [`${base}/failed?request_id=r1&reason=expired`]);
    await unmount();
  });

  test(`${name}: 30 回 pending のまま → reason=timeout`, async () => {
    const unmount = await mount(paths);
    for (let i = 1; i < 30; i += 1) await nextPoll();
    assert.equal(fetches, 30);
    assert.deepEqual(replaced, [`${base}/failed?request_id=r1&reason=timeout`]);
    await nextPoll();
    assert.equal(fetches, 30);
    await unmount();
  });
}

const bothPaths: UsePurchaseStatusPollingParams = { requestId: "r1", completePath: "/direct-sale/purchase/complete", failedPath: "/direct-sale/purchase/failed" };

test("行き先を両方渡せば slug を省ける: 渡したパスへ移る", async () => {
  statuses = [{ status: "completed" }];
  let unmount = await mount({}, bothPaths);
  assert.deepEqual(replaced, ["/direct-sale/purchase/complete?request_id=r1"]);
  await unmount();
  replaced.length = 0;
  statuses = [{ status: "expired" }];
  unmount = await mount({}, bothPaths);
  assert.deepEqual(replaced, ["/direct-sale/purchase/failed?request_id=r1&reason=expired"]);
  await unmount();
});
