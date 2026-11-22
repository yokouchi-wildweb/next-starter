// 送信の一覧の絞りの流れの検査(jsdom の上で hook を描く。client service と無限スクロールの土台は偽物)。
// - 送り元・送った人・件名・運営が送った物だけ(D210)が「絞り込み」で確定し、送信の一覧の口(カーソル)へ source / actor / q / sentBy で届く
// - 件名は前後の空白を落とし、空なら送らない・100 字で切る / クリアで全部が空に戻る
// - 絞りの選択肢の口: 送り元は表示名、送った人は名前で並べ、鍵・id は値にだけ(D46)。名前の無い物は決まった文
// 実行: pnpm test src/domains/core/messaging/components/AdminDispatchList/dispatchListFilters.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

// 送信の一覧の口と絞りの選択肢の口(呼ばれた値を残す)
const listCalls: Record<string, unknown>[] = [];
let filterOptionsCalls = 0;
mock.module("@/domains/core/messaging/services/client/adminMessagingClient", {
  namedExports: {
    listAdminDispatches: async (params: Record<string, unknown>) => {
      listCalls.push(params);
      return { items: [], nextCursor: null };
    },
    getAdminDispatchFilters: async () => {
      filterOptionsCalls += 1;
      return {
        sources: [
          { key: "messaging.admin.free", label: "管理画面からの送信" },
          { key: "orphan.source", label: null },
        ],
        actors: [
          { id: "11111111-1111-4111-8111-111111111111", name: "運営 太郎" },
          { id: "22222222-2222-4222-8222-222222222222", name: null },
        ],
      };
    },
  },
});
// 無限スクロールの土台: 渡された cursorFetcher と deps を残す(検査が 1 回目の取り出しを呼ぶ)
type QueryArgs = { cursorFetcher: (args: { cursor: string | null; limit: number }) => Promise<unknown>; deps: unknown[] };
let lastQuery: QueryArgs | null = null;
mock.module("@/hooks/useInfiniteScrollQuery", {
  namedExports: {
    useInfiniteScrollQuery: (args: QueryArgs) => {
      lastQuery = args;
      return { items: [], isInitialLoading: false, isFetchingMore: false, hasMore: false, error: null, sentinelRef: () => {}, retry: () => {}, revalidate: () => {} };
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SWRConfig: typeof import("swr").SWRConfig;
let filtersMod: typeof import("@/domains/core/messaging/hooks/useAdminDispatchFilters");
let listMod: typeof import("@/domains/core/messaging/hooks/useAdminDispatches");
let optionsMod: typeof import("@/domains/core/messaging/hooks/useAdminDispatchFilterOptions");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  filtersMod = await import("@/domains/core/messaging/hooks/useAdminDispatchFilters");
  listMod = await import("@/domains/core/messaging/hooks/useAdminDispatches");
  optionsMod = await import("@/domains/core/messaging/hooks/useAdminDispatchFilterOptions");
});
after(() => dom.window.close());
beforeEach(() => {
  listCalls.length = 0;
  filterOptionsCalls = 0;
  lastQuery = null;
});

/** hook を描いて、最新の戻り値を読む */
async function renderHook<T>(useIt: () => T) {
  const box: { current: T | null } = { current: null };
  function Probe() {
    box.current = useIt();
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  const wrap = (children: ReactNode) => createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
  await act(async () => root.render(wrap(createElement(Probe))));
  return {
    get: () => box.current as T,
    run: (fn: () => void) => act(async () => fn()),
    unmount: () => act(async () => root.unmount()),
  };
}

/** 絞りの hook と一覧の hook を一緒に描く(画面と同じつなぎ) */
const useFiltersAndList = () => {
  const state = filtersMod.useAdminDispatchFilters();
  listMod.useAdminDispatches({ filters: state.filters });
  return state;
};

/** 一覧の 1 回目の取り出しを呼び、口に渡った値 */
const fetchFirstPage = async () => {
  assert.ok(lastQuery, "一覧の hook が描かれた");
  await lastQuery.cursorFetcher({ cursor: null, limit: 50 });
  return listCalls.at(-1) ?? {};
};

test("dispatchSubjectQueryOf: 前後の空白を落とす・空は undefined・100 字で切る", () => {
  assert.equal(filtersMod.dispatchSubjectQueryOf("  春の  "), "春の");
  assert.equal(filtersMod.dispatchSubjectQueryOf("   "), undefined);
  assert.equal(filtersMod.dispatchSubjectQueryOf("あ".repeat(120))?.length, 100);
});

test("送り元・送った人・件名・運営が送った物だけは「絞り込み」で確定し、一覧の口へ届く", async () => {
  const view = await renderHook(useFiltersAndList);
  await view.run(() => {
    const { fields } = view.get();
    fields.setSource("messaging.admin.free");
    fields.setActor("11111111-1111-4111-8111-111111111111");
    fields.setSubject("  春のお知らせ ");
    fields.setAdminOnly(true);
  });
  // 確定する前は送らない
  assert.deepEqual(view.get().filters, {});
  const before = await fetchFirstPage();
  assert.equal(before.source, undefined);
  assert.equal(before.q, undefined);

  await view.run(() => view.get().apply());
  const sent = await fetchFirstPage();
  assert.equal(sent.source, "messaging.admin.free");
  assert.equal(sent.actor, "11111111-1111-4111-8111-111111111111");
  assert.equal(sent.q, "春のお知らせ");
  assert.equal(sent.sentBy, "admin");
  assert.ok(lastQuery!.deps.includes("春のお知らせ"), "絞りが変われば先頭から取り直す(deps)");

  await view.run(() => view.get().clear());
  const { fields } = view.get();
  assert.deepEqual([fields.source, fields.actor, fields.subject, fields.adminOnly], ["", "", "", false]);
  const cleared = await fetchFirstPage();
  assert.equal(cleared.source, undefined);
  assert.equal(cleared.actor, undefined);
  assert.equal(cleared.q, undefined);
  assert.equal(cleared.sentBy, undefined);
  await view.unmount();
});

test("空白だけの件名は送らない", async () => {
  const view = await renderHook(useFiltersAndList);
  await view.run(() => view.get().fields.setSubject("   "));
  await view.run(() => view.get().apply());
  assert.equal((await fetchFirstPage()).q, undefined);
  await view.unmount();
});

test("絞りの選択肢: 送り元は表示名・送った人は名前、鍵と id は値にだけ。名前の無い物は決まった文", async () => {
  const view = await renderHook(() => optionsMod.useAdminDispatchFilterOptions());
  await view.run(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(filterOptionsCalls, 1);
  const { sourceOptions, actorOptions, loaded } = view.get();
  assert.equal(loaded, true);
  assert.deepEqual(sourceOptions, [
    { value: "messaging.admin.free", label: "管理画面からの送信" },
    { value: "orphan.source", label: optionsMod.UNNAMED_SOURCE_LABEL },
  ]);
  assert.deepEqual(actorOptions, [
    { value: "11111111-1111-4111-8111-111111111111", label: "運営 太郎" },
    { value: "22222222-2222-4222-8222-222222222222", label: optionsMod.UNNAMED_ACTOR_LABEL },
  ]);
  await view.unmount();
});
