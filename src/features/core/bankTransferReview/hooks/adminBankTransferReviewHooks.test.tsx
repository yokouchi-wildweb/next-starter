// 管理画面の振込レビューの読む側の公開 hook の検査(jsdom の上で動かす。client 関数・toast・URL・門番は偽物)。
// - useAdminBankTransferReviewList: status・検索語の変化で 1 ページ目と選択の空に戻す / ページ移動で選択を空にする /
//   refresh で一覧と status 別件数を取り直す
// - useAdminBankTransferReviewMemo: 成功で toast(success)と一覧・詳細の取り直し、失敗で toast(error)と false
//   (成功扱いにしない)、空白は null で送る
// - useAdminBankTransferReview: reviewId が null の間は取得しない、walletEnabled は門番の値
// 実行: pnpm test src/features/core/bankTransferReview/hooks/adminBankTransferReviewHooks.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect, type Key } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

type Call = { fn: string; arg: unknown };
const calls: Call[] = [];
let memoFails = false;
let walletOpen = true;
const toasts: { message: unknown; variant?: string }[] = [];

mock.module("@/features/core/bankTransferReview", {
  namedExports: {
    adminListBankTransferReviews: async (arg: unknown) => {
      calls.push({ fn: "list", arg });
      return { items: [], total: 250, page: 1, limit: 100, profileNameAvailable: false };
    },
    adminGetBankTransferReviewStatusCounts: async (arg: unknown) => {
      calls.push({ fn: "counts", arg });
      return { counts: { pending_review: 1, needs_check: 0, investigating: 0, confirmed: 0, rejected: 0 } };
    },
    adminGetBankTransferReview: async (arg: unknown) => {
      calls.push({ fn: "detail", arg });
      return { review: { id: arg }, purchaseRequest: null, user: null, reviewer: null };
    },
    adminUpdateBankTransferReviewAdminMemo: async (arg: unknown) => {
      calls.push({ fn: "memo", arg });
      if (memoFails) throw new Error("boom");
      return { review: {} };
    },
  },
});
mock.module("@/lib/toast", {
  namedExports: {
    useToast: () => ({
      showToast: (message: unknown, variant?: string) => {
        toasts.push({ message, variant });
      },
    }),
  },
});
mock.module("next/navigation", {
  namedExports: {
    useSearchParams: () => new URLSearchParams("searchQuery=taro"),
  },
});
mock.module("@/featureGate/client", {
  namedExports: {
    useGate: () => ({ enabled: (name: string) => name === "wallet" && walletOpen }),
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SWRConfig: typeof import("swr").SWRConfig;
let useAdminBankTransferReviewList: typeof import("./useAdminBankTransferReviewList").useAdminBankTransferReviewList;
let useAdminBankTransferReviewStatusCounts: typeof import("./useAdminBankTransferReviewStatusCounts").useAdminBankTransferReviewStatusCounts;
let useAdminBankTransferReviewMemo: typeof import("./useAdminBankTransferReviewMemo").useAdminBankTransferReviewMemo;
let useAdminBankTransferReview: typeof import("./useAdminBankTransferReview").useAdminBankTransferReview;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  ({ useAdminBankTransferReviewList } = await import("./useAdminBankTransferReviewList"));
  ({ useAdminBankTransferReviewStatusCounts } = await import("./useAdminBankTransferReviewStatusCounts"));
  ({ useAdminBankTransferReviewMemo } = await import("./useAdminBankTransferReviewMemo"));
  ({ useAdminBankTransferReview } = await import("./useAdminBankTransferReview"));
});
after(() => dom.window.close());
beforeEach(() => {
  calls.length = 0;
  toasts.length = 0;
  memoFails = false;
  walletOpen = true;
});

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** テストごとに新しいキャッシュの SWRConfig で包んで描く */
const render = async (element: ReturnType<typeof createElement>) => {
  const root = createRoot(document.createElement("div"));
  const wrapped = createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false } },
    element,
  );
  await act(async () => root.render(wrapped));
  await flush();
  return {
    rerender: async (next: ReturnType<typeof createElement>) => {
      await act(async () =>
        root.render(
          createElement(
            SWRConfig,
            { value: { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false } },
            next,
          ),
        ),
      );
      await flush();
    },
    unmount: () => act(async () => root.unmount()),
  };
};

type ListState = ReturnType<typeof useAdminBankTransferReviewList>;
let listState: ListState | undefined;
const ListProbe = ({ status, searchQuery }: { status: "pending_review" | "confirmed"; searchQuery?: string }) => {
  const state = useAdminBankTransferReviewList({ status, searchQuery, limit: 100 });
  useAdminBankTransferReviewStatusCounts({ searchQuery });
  useEffect(() => {
    listState = state;
  });
  return null;
};

test("一覧: URL の検索語と limit で取得し、総ページ数を返す", async () => {
  const view = await render(createElement(ListProbe, { status: "pending_review" }));
  assert.deepEqual(
    calls.filter((c) => c.fn === "list").map((c) => c.arg),
    [{ status: "pending_review", searchQuery: "taro", page: 1, limit: 100 }],
  );
  assert.deepEqual(
    calls.filter((c) => c.fn === "counts").map((c) => c.arg),
    [{ searchQuery: "taro" }],
  );
  assert.equal(listState?.totalPages, 3);
  assert.equal(listState?.searchQuery, "taro");
  await view.unmount();
});

test("一覧: ページ移動で選択を空にし、status の変化で 1 ページ目と空の選択に戻す", async () => {
  // SWRConfig の provider はキャッシュを分けるだけなので、同じ root で status を変えて描き直す
  const root = createRoot(document.createElement("div"));
  const tree = (status: "pending_review" | "confirmed") =>
    createElement(
      SWRConfig,
      { value: { dedupingInterval: 0, revalidateOnFocus: false } },
      createElement(ListProbe, { status, searchQuery: "" }),
    );
  await act(async () => root.render(tree("pending_review")));
  await flush();

  await act(async () => listState?.setSelectedKeys(["a", "b"] as Key[]));
  assert.deepEqual(listState?.selectedKeys, ["a", "b"]);
  await act(async () => listState?.setPage(2));
  assert.equal(listState?.page, 2);
  assert.deepEqual(listState?.selectedKeys, []);

  await act(async () => listState?.setSelectedKeys(["c"] as Key[]));
  await act(async () => root.render(tree("confirmed")));
  await flush();
  assert.equal(listState?.page, 1);
  assert.deepEqual(listState?.selectedKeys, []);
  assert.deepEqual(calls.filter((c) => c.fn === "list").at(-1)?.arg, {
    status: "confirmed",
    searchQuery: undefined,
    page: 1,
    limit: 100,
  });
  await act(async () => root.unmount());
});

test("一覧: refresh は一覧と status 別件数を取り直す", async () => {
  const view = await render(createElement(ListProbe, { status: "pending_review", searchQuery: "x" }));
  calls.length = 0;
  await act(async () => {
    await listState?.refresh();
  });
  await flush();
  assert.equal(calls.filter((c) => c.fn === "list").length, 1);
  assert.equal(calls.filter((c) => c.fn === "counts").length, 1);
  await view.unmount();
});

let memoState: ReturnType<typeof useAdminBankTransferReviewMemo> | undefined;
let detailState: ReturnType<typeof useAdminBankTransferReview> | undefined;
const MemoProbe = ({ reviewId }: { reviewId: string | null }) => {
  const memo = useAdminBankTransferReviewMemo();
  const detail = useAdminBankTransferReview(reviewId);
  useAdminBankTransferReviewList({ status: "pending_review", searchQuery: "", limit: 100 });
  useEffect(() => {
    memoState = memo;
    detailState = detail;
  });
  return null;
};

test("メモ: 成功で success の toast と一覧・詳細の取り直し、空白は null で送る", async () => {
  const view = await render(createElement(MemoProbe, { reviewId: "r1" }));
  calls.length = 0;
  let saved: boolean | undefined;
  await act(async () => {
    saved = await memoState?.save("r1", "   ", { saving: "保存中", success: "更新しました" });
  });
  await flush();
  assert.equal(saved, true);
  assert.deepEqual(calls.find((c) => c.fn === "memo")?.arg, { reviewId: "r1", adminMemo: null });
  assert.deepEqual(
    toasts.map((t) => (typeof t.message === "string" ? [t.message, t.variant] : ["loading", undefined])),
    [
      ["loading", undefined],
      ["更新しました", "success"],
    ],
  );
  assert.ok(calls.some((c) => c.fn === "list"), "一覧を取り直す");
  assert.ok(calls.some((c) => c.fn === "detail"), "詳細を取り直す");
  await view.unmount();
});

test("メモ: 失敗は error の toast と false(成功扱いにしない)、取り直さない", async () => {
  memoFails = true;
  const view = await render(createElement(MemoProbe, { reviewId: "r1" }));
  calls.length = 0;
  let saved: boolean | undefined;
  await act(async () => {
    saved = await memoState?.save("r1", " メモ ");
  });
  await flush();
  assert.equal(saved, false);
  assert.deepEqual(calls.find((c) => c.fn === "memo")?.arg, { reviewId: "r1", adminMemo: "メモ" });
  assert.equal(toasts.at(-1)?.variant, "error");
  assert.ok(!toasts.some((t) => t.variant === "success"));
  assert.ok(!calls.some((c) => c.fn === "detail"), "失敗では詳細を取り直さない");
  assert.equal(memoState?.isSaving, false);
  await view.unmount();
});

test("詳細: reviewId が null の間は取得しない、walletEnabled は門番の値", async () => {
  walletOpen = false;
  const view = await render(createElement(MemoProbe, { reviewId: null }));
  assert.ok(!calls.some((c) => c.fn === "detail"));
  assert.equal(detailState?.walletEnabled, false);
  assert.equal(detailState?.review, undefined);
  await view.rerender(createElement(MemoProbe, { reviewId: "r9" }));
  assert.deepEqual(calls.filter((c) => c.fn === "detail").map((c) => c.arg), ["r9"]);
  assert.deepEqual(detailState?.review, { id: "r9" });
  await view.unmount();
});
