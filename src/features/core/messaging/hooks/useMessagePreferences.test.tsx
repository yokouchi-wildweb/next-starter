// useMessagePreferences の検査(jsdom の上で描く。client service は偽物)。
// - 表を読む(応答の入れ子のまま)/ 止め方 5 つ(1 マス・種類まるごと・経路まるごと・全部・種別まるごと)は client に決まった入力を送り、応答の表を SWR のキャッシュに書く(取り直さない)/ 変えている間の pendingKey
// 実行: pnpm test src/features/core/messaging/hooks/useMessagePreferences.test.tsx
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

type Input = { category: string; channel: string; optedOut: boolean } | { kind: string; optedOut: boolean };
const leaf = (optedOut: boolean, via: string | null) => ({ key: "marketing", label: "お得な情報", description: null, optedOut, via });
const frame = (optedOut: boolean, via: string | null) => [{ kind: "marketing", groups: [{ key: null, label: null, categories: [leaf(optedOut, via)] }] }];
const table = (optedOut: boolean, allOptedOut = false, kindOptedOut = false) => ({
  allOptedOut,
  categories: [{ key: "marketing", optedOut: false }],
  kinds: [{ kind: "marketing", optedOut: kindOptedOut }],
  channels: [
    { key: "email", label: "メール", hasAddress: true, connectHref: null, optedOut: false, kinds: frame(optedOut, optedOut ? "cell" : null) },
    { key: "inApp", label: "お知らせ", hasAddress: true, connectHref: null, optedOut: false, kinds: frame(kindOptedOut, kindOptedOut ? "kind" : null) },
  ],
});

let gets = 0;
const sets: Input[] = [];
let release: (() => void) | null = null;
mock.module("@/features/core/messaging/services/client/preferenceClient", {
  namedExports: {
    getMessagePreferences: async () => {
      gets += 1;
      return table(false);
    },
    setMessagePreference: async (input: Input) => {
      sets.push(input);
      await new Promise<void>((resolve) => (release = resolve));
      if ("kind" in input) return table(input.optedOut, false, input.optedOut);
      return input.category === "*" ? table(true, input.optedOut) : table(input.optedOut);
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SWRConfig: typeof import("swr").SWRConfig;
let useMessagePreferences: typeof import("./useMessagePreferences").useMessagePreferences;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  ({ useMessagePreferences } = await import("./useMessagePreferences"));
});
after(() => dom.window.close());
beforeEach(() => {
  gets = 0;
  sets.length = 0;
});

type Hook = ReturnType<typeof useMessagePreferences>;
const mount = async () => {
  const latest: { current: Hook | null } = { current: null };
  const root = createRoot(document.createElement("div"));
  const Probe = ({ report }: { report: (h: Hook) => void }) => {
    report(useMessagePreferences());
    return null;
  };
  await act(async () => {
    root.render(createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, createElement(Probe, { report: (h: Hook) => (latest.current = h) })));
  });
  return { hook: () => latest.current!, unmount: () => act(async () => root.unmount()) };
};

test("表を読む(応答の入れ子のまま)", async () => {
  const view = await mount();
  assert.equal(gets, 1);
  assert.equal(view.hook().preferences?.channels[0].kinds[0].groups[0].categories[0].key, "marketing");
  await view.unmount();
});

/** 1 つの変更を走らせ、変えている間の pendingKey と送った入力を返す */
const run = async (view: Awaited<ReturnType<typeof mount>>, start: (h: Hook) => Promise<unknown>) => {
  const getsBefore = gets;
  let done: Promise<unknown> = Promise.resolve();
  await act(async () => {
    done = start(view.hook());
  });
  const pending = view.hook().pendingKey;
  await act(async () => {
    release?.();
    await done;
  });
  assert.equal(view.hook().pendingKey, null);
  assert.equal(gets, getsBefore, "取り直さない");
  return { pending, input: sets.at(-1) };
};

test("止め方 5 つの入力と pendingKey", async () => {
  const view = await mount();
  assert.deepEqual(await run(view, (h) => h.setCell("marketing", "email", false)), {
    pending: "marketing:email",
    input: { category: "marketing", channel: "email", optedOut: true },
  });
  assert.equal(view.hook().preferences?.channels[0].kinds[0].groups[0].categories[0].optedOut, true, "応答の表を書く");
  assert.deepEqual(await run(view, (h) => h.setCategoryWide("marketing", true)), {
    pending: "marketing:*",
    input: { category: "marketing", channel: "*", optedOut: true },
  });
  assert.deepEqual(await run(view, (h) => h.setChannelWide("email", false)), {
    pending: "*:email",
    input: { category: "*", channel: "email", optedOut: false },
  });
  assert.deepEqual(await run(view, (h) => h.setAll(true)), {
    pending: "*:*",
    input: { category: "*", channel: "*", optedOut: true },
  });
  assert.equal(view.hook().preferences?.allOptedOut, true);
  assert.deepEqual(await run(view, (h) => h.setKind("marketing", true)), {
    pending: "kind:marketing",
    input: { kind: "marketing", optedOut: true },
  });
  await view.unmount();
});
