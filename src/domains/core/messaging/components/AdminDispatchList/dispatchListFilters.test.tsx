// 送信の一覧の絞りの流れの検査(jsdom の上で hook を描く。client service と無限スクロールの土台は偽物)。
// - 既定は手動送信(sentBy admin、D210)。選んだ絞り込みはすぐ送信の一覧の口(カーソル)へ source / actor / sentBy で届く
// - 件名は打ち終えて待ってから q で届く。前後の空白を落とし、空なら送らない・100 字で切る
// - 自動送信(sentBy system)は送った人で絞らない / すべて解除は送った側を残して全部を空に戻す
// - 期間の区切り: 今日を含む日数の 0 時から / 指定 = 日付の from・翌日の 0 時(未満)
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
  // 描いた値は props の callback で外へ渡す(部品の中で外の値を書き換えない)
  function Probe({ onValue }: { onValue: (value: T) => void }) {
    onValue(useIt());
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  const wrap = (children: ReactNode) => createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
  await act(async () => root.render(wrap(createElement(Probe, { onValue: (value: T) => { box.current = value; } }))));
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

/** 件名の入力が一覧に効くまで待つ */
const waitSubject = () => new Promise((resolve) => setTimeout(resolve, filtersMod.DISPATCH_SUBJECT_DEBOUNCE_MS + 50));

test("dispatchPeriodStartOf: 今日を含む日数の最初の日の 0 時。すべて・指定は undefined", () => {
  const now = new Date(2026, 10, 25, 15, 30);
  assert.equal(filtersMod.dispatchPeriodStartOf("today", now), new Date(2026, 10, 25).toISOString());
  assert.equal(filtersMod.dispatchPeriodStartOf("7d", now), new Date(2026, 10, 19).toISOString());
  assert.equal(filtersMod.dispatchPeriodStartOf("30d", now), new Date(2026, 9, 27).toISOString());
  assert.equal(filtersMod.dispatchPeriodStartOf("all", now), undefined);
  assert.equal(filtersMod.dispatchPeriodStartOf("custom", now), undefined);
});

test("既定は手動送信。選んだ絞り込みはすぐ一覧の口へ届き、件名は待ってから届く", async () => {
  const view = await renderHook(useFiltersAndList);
  assert.equal((await fetchFirstPage()).sentBy, "admin", "既定 = 手動送信(sentBy admin)");
  await view.run(() => {
    const { fields } = view.get();
    fields.setSource("messaging.admin.free");
    fields.setActor("11111111-1111-4111-8111-111111111111");
    fields.setSubject("  春のお知らせ ");
  });
  const picked = await fetchFirstPage();
  assert.equal(picked.source, "messaging.admin.free");
  assert.equal(picked.actor, "11111111-1111-4111-8111-111111111111");
  assert.equal(picked.q, undefined, "件名は打ち終えてから");
  assert.equal(view.get().detailCount, 2);

  await view.run(waitSubject);
  const typed = await fetchFirstPage();
  assert.equal(typed.q, "春のお知らせ");
  assert.ok(lastQuery!.deps.includes("春のお知らせ"), "絞りが変われば先頭から取り直す(deps)");

  await view.run(() => view.get().clearAll());
  const { fields } = view.get();
  assert.deepEqual([fields.source, fields.actor, fields.subject, fields.sentBy], ["", "", "", "admin"], "送った側は残す");
  const cleared = await fetchFirstPage();
  assert.equal(cleared.source, undefined);
  assert.equal(cleared.actor, undefined);
  assert.equal(cleared.q, undefined);
  assert.equal(cleared.sentBy, "admin");
  await view.unmount();
});

test("自動送信は sentBy system で、送った人で絞らない", async () => {
  const view = await renderHook(useFiltersAndList);
  await view.run(() => view.get().fields.setActor("11111111-1111-4111-8111-111111111111"));
  await view.run(() => view.get().fields.setSentBy("system"));
  assert.equal(view.get().fields.actor, "", "自動送信にすると送った人は空に戻す");
  const sent = await fetchFirstPage();
  assert.equal(sent.sentBy, "system");
  assert.equal(sent.actor, undefined);
  await view.unmount();
});

test("期間の指定は日付の from・翌日の 0 時(未満)。区切りに戻すと日付は空に戻る", async () => {
  const view = await renderHook(useFiltersAndList);
  await view.run(() => view.get().fields.setPeriod("custom"));
  await view.run(() => {
    view.get().fields.setFromDate("2026-11-01");
    view.get().fields.setToDate("2026-11-10");
  });
  const custom = await fetchFirstPage();
  assert.equal(custom.from, new Date(2026, 10, 1).toISOString());
  assert.equal(custom.to, new Date(2026, 10, 11).toISOString());
  await view.run(() => view.get().fields.setPeriod("all"));
  assert.deepEqual([view.get().fields.fromDate, view.get().fields.toDate], ["", ""]);
  const all = await fetchFirstPage();
  assert.equal(all.from, undefined);
  assert.equal(all.to, undefined);
  await view.unmount();
});

test("空白だけの件名は送らない", async () => {
  const view = await renderHook(useFiltersAndList);
  await view.run(() => view.get().fields.setSubject("   "));
  await view.run(waitSubject);
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
