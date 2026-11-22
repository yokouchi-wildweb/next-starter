// テンプレートの一覧の文字の検索の検査(jsdom の上で hook useAdminMessageTemplateList を描く。client service と無限スクロールの土台は偽物)。
// - 入力しただけでは探さず、確定(apply)で GET templates に q が届く / 前後の空白を落とす・空白だけは送らない・100 字で切る
// - クリアで入力も確定も空 / 探している間の保存は取り直す(絞りから外れたかは一覧で分からない)
// 実行: pnpm test src/domains/core/messaging/components/AdminMessageTemplateList/templateSearch.test.tsx
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

const listCalls: Record<string, unknown>[] = [];
mock.module("@/domains/core/messaging/services/client/templateClient", {
  namedExports: {
    listMessageTemplates: async (params: Record<string, unknown>) => {
      listCalls.push(params);
      return { items: [], nextCursor: null };
    },
  },
});
// 無限スクロールの土台: cursorFetcher を残し、取り直し・置き換えの呼び出しを数える
type QueryArgs = { cursorFetcher: (args: { cursor: string | null; limit: number }) => Promise<unknown>; deps: unknown[] };
let lastQuery: QueryArgs | null = null;
const calls = { revalidate: 0, updateItems: 0 };
mock.module("@/hooks/useInfiniteScrollQuery", {
  namedExports: {
    useInfiniteScrollQuery: (args: QueryArgs) => {
      lastQuery = args;
      return {
        items: [],
        isInitialLoading: false,
        isFetchingMore: false,
        hasMore: false,
        error: null,
        sentinelRef: () => {},
        retry: () => {},
        revalidate: () => void (calls.revalidate += 1),
        updateItems: () => void (calls.updateItems += 1),
        removeItems: () => {},
      };
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let mod: typeof import("@/domains/core/messaging/hooks/useAdminMessageTemplateList");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  mod = await import("@/domains/core/messaging/hooks/useAdminMessageTemplateList");
});
after(() => dom.window.close());
beforeEach(() => {
  listCalls.length = 0;
  lastQuery = null;
  calls.revalidate = 0;
  calls.updateItems = 0;
});

type State = ReturnType<typeof import("@/domains/core/messaging/hooks/useAdminMessageTemplateList").useAdminMessageTemplateList>;
async function renderList() {
  const box: { current: State | null } = { current: null };
  function Probe() {
    box.current = mod.useAdminMessageTemplateList();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  return {
    get: () => box.current as State,
    run: (fn: () => void) => act(async () => fn()),
    unmount: () => act(async () => root.unmount()),
  };
}

const fetchFirstPage = async () => {
  assert.ok(lastQuery);
  await lastQuery.cursorFetcher({ cursor: null, limit: 50 });
  return listCalls.at(-1) ?? {};
};

test("templateQueryOf: 前後の空白を落とす・100 字で切る", () => {
  assert.equal(mod.templateQueryOf("  春  "), "春");
  assert.equal(mod.templateQueryOf("   "), "");
  assert.equal(mod.templateQueryOf("あ".repeat(130)).length, 100);
});

test("入力しただけでは探さず、確定で q が届く。クリアで両方空", async () => {
  const view = await renderList();
  await view.run(() => view.get().search.setText("  春のセール "));
  assert.equal((await fetchFirstPage()).q, undefined, "確定前は送らない");

  await view.run(() => view.get().search.apply());
  assert.equal(view.get().search.q, "春のセール");
  assert.equal((await fetchFirstPage()).q, "春のセール");
  assert.ok(lastQuery!.deps.includes("春のセール"), "検索が変われば先頭から取り直す(deps)");

  await view.run(() => view.get().search.clear());
  assert.equal(view.get().search.text, "");
  assert.equal(view.get().search.q, "");
  assert.equal((await fetchFirstPage()).q, undefined);
  await view.unmount();
});

test("空白だけの検索は送らない", async () => {
  const view = await renderList();
  await view.run(() => view.get().search.setText("   "));
  await view.run(() => view.get().search.apply());
  assert.equal((await fetchFirstPage()).q, undefined);
  await view.unmount();
});

test("探している間の保存は取り直す、探していなければ行を置き換える", async () => {
  const view = await renderList();
  const saved = { id: "t1" } as Parameters<State["modal"]["onChanged"]>[0];
  await view.run(() => view.get().modal.onChanged(saved, "update"));
  assert.deepEqual([calls.revalidate, calls.updateItems], [0, 1]);

  await view.run(() => view.get().search.setText("春"));
  await view.run(() => view.get().search.apply());
  await view.run(() => view.get().modal.onChanged(saved, "update"));
  assert.deepEqual([calls.revalidate, calls.updateItems], [1, 1]);
  await view.unmount();
});
