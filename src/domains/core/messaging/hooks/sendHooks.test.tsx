// 送る画面の公開の hook(D191)の検査(jsdom の上で描く。client service・離れる前の確認は偽物)。
// - useSendSteps: 書く → 確認 → 結果、書きかけ = 開いていて結果の段でなく呼び手の書きかけがある時(離れる前の確かめ・closeConfirm)、reset
// - useIdempotencyKey: 開いた時の鍵 1 つ、renew で新しい鍵 / 鍵を作る関数は hooks の入口から出ない
// - useSendPreview / useSendTest: 渡した口で描いて持つ・消す / 毎回新しい鍵を付けて送る
// - initialChannelsOff: on に無い物を外す、全部外れる時は外さない
// - 定義連絡: 選択肢(条件 = 項目の鍵 / entry broadcast、enabled の間だけ)・送る・表示例・テストが定義連絡の口を呼ぶ
// - useSendResults: 届かなかった人のページと送信チャンネルの数、送信が無ければ取らない / useRecipientChannels: 条件つきで取る、利用者が無ければ取らない
// 実行: pnpm test src/domains/core/messaging/hooks/sendHooks.test.tsx
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

const calls: unknown[][] = [];
const OPTIONS = { recordTarget: { key: "bankTransferReview.reviews", label: "振込レビュー" }, definitions: [] };
mock.module("@/domains/core/messaging/services/client/definitionSendClient", {
  namedExports: {
    sendAdminDefinition: async (input: unknown) => {
      calls.push(["send", input]);
      return { dispatchId: "d1", status: "queued", counts: { recipientCount: 1, channelCounts: {}, queuedCount: 0 }, afterSend: null };
    },
    previewAdminDefinition: async (input: unknown) => {
      calls.push(["preview", input]);
      return { messageKey: "k", channels: [] };
    },
    sendAdminDefinitionTest: async (input: unknown) => {
      calls.push(["test", input]);
      return { dispatchId: "t1", status: "completed", counts: { recipientCount: 1, channelCounts: {}, queuedCount: 0 } };
    },
    getAdminDefinitionOptions: async (query: unknown) => {
      calls.push(["options", query]);
      return OPTIONS;
    },
  },
});
mock.module("@/domains/core/messaging/services/client/sendResultsClient", {
  namedExports: {
    getAdminSendResults: async (dispatchId: string, params: unknown) => {
      calls.push(["results", dispatchId, params]);
      return {
        channels: { email: { targeted: 2, sent: 1, failed: 1, suppressed: 0, skipped_no_address: 0, skipped_throttled: 0 } },
        failed: { items: [{ userId: "u1", name: "花子", channel: "email", status: "failed", reason: null }], nextCursor: null },
      };
    },
    getAdminRecipientChannels: async (userId: string, query: unknown) => {
      calls.push(["recipient", userId, query]);
      return { email: { available: true }, line: { available: false, reason: "no_address" } };
    },
  },
});
const guarded: boolean[] = [];
mock.module("@/lib/unsavedGuard", { namedExports: { useUnsavedGuard: (when: boolean) => void guarded.push(when) } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SWRConfig: typeof import("swr").SWRConfig;
let hooks: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  hooks = await import("./index");
});
after(() => dom.window.close());
beforeEach(() => {
  calls.length = 0;
  guarded.length = 0;
});

const mount = async <T,>(useHook: () => T) => {
  const latest: { current: T | null } = { current: null };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const Probe = ({ report }: { report: (value: T) => void }) => {
    report(useHook());
    return null;
  };
  const render = () =>
    root.render(
      createElement(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0 } },
        createElement(Probe, { report: (value: T) => (latest.current = value) }),
      ),
    );
  await act(async () => render());
  return { value: () => latest.current!, unmount: () => act(async () => root.unmount()) };
};
/** 非同期の取得を待つ */
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 10)));

test("useSendSteps: 書く → 確認 → 結果、書きかけの確かめ、reset", async () => {
  let editing = false;
  let open = true;
  const view = await mount(() => hooks.useSendSteps<{ id: string }>({ open, editing }));
  const s = () => view.value();
  assert.equal(s().step, "edit");
  assert.equal(s().dirty, false, "書きかけが無ければ確かめない");
  assert.deepEqual(s().closeConfirm, { enabled: false, message: "入力中の内容は送信されていません。閉じてもよろしいですか？" });
  editing = true;
  await act(async () => s().toConfirm());
  assert.equal(s().step, "confirm");
  assert.equal(s().dirty, true);
  assert.equal(s().closeConfirm.enabled, true);
  assert.equal(guarded.at(-1), true, "ページを離れる前の確かめを張る");
  await act(async () => s().backToEdit());
  assert.equal(s().step, "edit");
  await act(async () => s().finish({ id: "d1" }));
  assert.deepEqual([s().step, s().result], ["done", { id: "d1" }]);
  assert.equal(s().dirty, false, "結果の段は書きかけにしない");
  await act(async () => s().reset());
  assert.deepEqual([s().step, s().result], ["edit", null]);
  open = false;
  await act(async () => s().backToEdit());
  assert.equal(s().dirty, false, "閉じていれば書きかけにしない");
  await view.unmount();
});

test("useIdempotencyKey: 鍵は 1 つ、renew で新しく。鍵を作る関数は入口から出ない", async () => {
  const view = await mount(() => hooks.useIdempotencyKey());
  const first = view.value().key;
  assert.equal(typeof first, "string");
  assert.ok(first.length >= 8, "サーバーの鍵の長さ(8〜128)");
  await act(async () => view.value().renew());
  assert.notEqual(view.value().key, first);
  await view.unmount();
  assert.equal("newIdempotencyKey" in hooks, false);
  assert.equal("newKey" in hooks, false);
});

test("useSendPreview / useSendTest: 渡した口で描いて持つ・消す / 毎回新しい鍵を付けて送る", async () => {
  const fetched: unknown[] = [];
  const view = await mount(() => ({
    preview: hooks.useSendPreview({
      fetcher: async (input: { n: number }) => {
        fetched.push(input);
        return { shown: input.n };
      },
    }),
    test: hooks.useSendTest<{ n: number }, { ok: boolean }>({
      fetcher: async (input: { n: number; idempotencyKey: string }) => {
        fetched.push(input);
        return { ok: true };
      },
    }),
  }));
  const v = () => view.value();
  assert.equal(v().preview.preview, null);
  await act(async () => {
    await v().preview.run({ n: 1 });
  });
  assert.deepEqual(v().preview.preview, { shown: 1 });
  await act(async () => v().preview.close());
  assert.equal(v().preview.preview, null);
  await act(async () => {
    await v().test.run({ n: 2 });
    await v().test.run({ n: 3 });
  });
  const tests = fetched.slice(1) as { n: number; idempotencyKey: string }[];
  assert.deepEqual(tests.map((item) => item.n), [2, 3]);
  assert.equal(typeof tests[0]!.idempotencyKey, "string");
  assert.notEqual(tests[0]!.idempotencyKey, tests[1]!.idempotencyKey, "テストは毎回新しい鍵");
  await view.unmount();
});

test("initialChannelsOff: on に無い物を外す、全部外れる時は外さない", () => {
  assert.deepEqual(hooks.initialChannelsOff(["email", "inApp", "line"], ["inApp"]), ["email", "line"]);
  assert.deepEqual(hooks.initialChannelsOff(["email", "inApp"], ["email", "inApp"]), []);
  assert.deepEqual(hooks.initialChannelsOff(["email", "inApp"], ["line"]), [], "全部外れる時は全部オン");
  assert.deepEqual(hooks.initialChannelsOff([], []), []);
});

test("定義連絡: 選択肢(条件ごと、enabled の間だけ)・送る・表示例・テストは定義連絡の口", async () => {
  assert.equal(hooks.definitionOptionsKey({ recordTarget: "a.b" }), "messaging/admin/definitions/options?recordTarget=a.b");
  assert.equal(hooks.definitionOptionsKey({ entry: "broadcast" }), "messaging/admin/definitions/options?entry=broadcast");

  const closed = await mount(() => hooks.useDefinitionSendOptions({ recordTarget: "bankTransferReview.reviews" }, false));
  await settle();
  assert.equal(closed.value().options, null);
  assert.equal(calls.length, 0, "enabled でなければ取らない");
  await closed.unmount();

  const view = await mount(() => ({
    options: hooks.useDefinitionSendOptions({ recordTarget: "bankTransferReview.reviews" }),
    send: hooks.useDefinitionSend(),
    preview: hooks.useDefinitionPreview(),
    test: hooks.useDefinitionTest(),
  }));
  await settle();
  const v = () => view.value();
  assert.deepEqual(v().options.options, OPTIONS);
  assert.deepEqual(calls[0], ["options", { recordTarget: "bankTransferReview.reviews" }]);
  const entry = { recordTarget: "bankTransferReview.reviews", recordIds: ["r1"], message: "bankTransferReview.statement" };
  await act(async () => {
    await v().send.send({ entry, idempotencyKey: "key-12345678" });
    await v().preview.run({ entry });
    await v().test.run({ entry });
  });
  assert.deepEqual(calls.slice(1).map((call) => call[0]), ["send", "preview", "test"]);
  assert.deepEqual(calls[1]![1], { entry, idempotencyKey: "key-12345678" });
  assert.deepEqual(v().preview.preview, { messageKey: "k", channels: [] });
  assert.equal(typeof (calls[3]![1] as { idempotencyKey?: string }).idempotencyKey, "string", "テストは鍵を付ける");
  await view.unmount();
});

test("useSendResults / useRecipientChannels: 送信・利用者があれば取る、無ければ取らない", async () => {
  const none = await mount(() => ({ results: hooks.useSendResults(null), recipient: hooks.useRecipientChannels(null) }));
  await settle();
  assert.equal(calls.length, 0);
  assert.equal(none.value().results.channels, null);
  assert.equal(none.value().recipient.channels, null);
  await none.unmount();

  const view = await mount(() => ({
    results: hooks.useSendResults("d1", { limit: 20 }),
    recipient: hooks.useRecipientChannels("u1", { message: "bankTransferReview.statement" }),
  }));
  await settle();
  const v = () => view.value();
  assert.deepEqual(calls.find((call) => call[0] === "results"), ["results", "d1", { cursor: null, limit: 20 }]);
  assert.deepEqual(v().results.failed.items, [{ userId: "u1", name: "花子", channel: "email", status: "failed", reason: null }]);
  assert.equal(v().results.failed.hasMore, false);
  assert.equal(v().results.channels?.email?.failed, 1);
  assert.deepEqual(calls.find((call) => call[0] === "recipient"), ["recipient", "u1", { message: "bankTransferReview.statement" }]);
  assert.deepEqual(v().recipient.channels, { email: { available: true }, line: { available: false, reason: "no_address" } });
  assert.equal(hooks.recipientChannelsKey("u1", { category: "notice" }), "messaging/admin/recipients/u1/channels?category=notice");
  await view.unmount();
});
