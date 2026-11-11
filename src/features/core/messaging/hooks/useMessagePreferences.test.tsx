// useMessagePreferences の検査(jsdom の上で描く。client service は偽物)。
// - 表を読む / 1 マスと全体の変更は client を呼び、応答の表を SWR のキャッシュに書く(取り直さない)/ 変えている間の pendingKey
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

type Input = { category: string; channel: string; optedOut: boolean };
const table = (optedOut: boolean, allOptedOut = false) => ({
  allOptedOut,
  channels: [{ key: "email", label: "メール", hasAddress: true, connectHref: null }],
  categories: [{ key: "marketing", label: "お得な情報", description: null, kind: "marketing", cells: [{ channel: "email", optedOut, via: optedOut ? "cell" : null }] }],
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

test("表を読む", async () => {
  const view = await mount();
  assert.equal(gets, 1);
  assert.equal(view.hook().preferences?.categories[0].cells[0].optedOut, false);
  await view.unmount();
});

test("1 マスを止める: client に optedOut true、変えている間は pendingKey、応答の表をキャッシュに書き取り直さない", async () => {
  const view = await mount();
  const getsBefore = gets;
  let done: Promise<unknown> = Promise.resolve();
  await act(async () => {
    done = view.hook().setCell("marketing", "email", false);
  });
  assert.equal(view.hook().pendingKey, "marketing:email");
  await act(async () => {
    release?.();
    await done;
  });
  assert.deepEqual(sets, [{ category: "marketing", channel: "email", optedOut: true }]);
  assert.equal(view.hook().pendingKey, null);
  assert.equal(view.hook().preferences?.categories[0].cells[0].optedOut, true);
  assert.equal(gets, getsBefore, "取り直さない");
  await view.unmount();
});

test("全体: '*' '*' を送り、allOptedOut が応答の値になる", async () => {
  const view = await mount();
  let done: Promise<unknown> = Promise.resolve();
  await act(async () => {
    done = view.hook().setAll(true);
  });
  assert.equal(view.hook().pendingKey, "*:*");
  await act(async () => {
    release?.();
    await done;
  });
  assert.deepEqual(sets, [{ category: "*", channel: "*", optedOut: true }]);
  assert.equal(view.hook().preferences?.allOptedOut, true);
  await view.unmount();
});
