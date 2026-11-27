// useSeamlessReel の読み込みの途中の戻しの検査(D153): 読み込みの途中に reset・次の load があったら、前の回の
// 知らせ(進み・状態・失敗)と結果(ready / error)を戻した後の状態に入れない。SeamlessReel・音・ページを離れる時は偽物。
// 実行: pnpm test src/lib/seamlessVideo/hooks/useSeamlessReel.test.tsx
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

type Opts = { onFragmentAppended?: (a: number, t: number) => void; onError?: (e: Error) => void };
/** 読み込みを手で終えられる偽の SeamlessReel。作られた順に並べる */
class FakeReel {
  audioEnabled = true;
  destroyed = false;
  finish!: () => void;
  fail!: (e: Error) => void;
  constructor(_video: unknown, readonly opts: Opts) {
    reels.push(this);
  }
  load() {
    return new Promise<void>((resolve, reject) => {
      this.finish = resolve;
      this.fail = reject;
    });
  }
  destroy() {
    this.destroyed = true;
  }
}
const reels: FakeReel[] = [];
mock.module("../core/SeamlessReel", { namedExports: { SeamlessReel: FakeReel } });
mock.module("@/lib/webAudio", { namedExports: { getSharedAudioEngine: () => ({ unlock: async () => {} }) } });
mock.module("@/lib/pageLeave", { namedExports: { useOnPageLeave: () => {} } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useSeamlessReel: typeof import("./useSeamlessReel").useSeamlessReel;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useSeamlessReel } = await import("./useSeamlessReel"));
});
after(() => dom.window.close());
beforeEach(() => {
  reels.length = 0;
});

type Api = ReturnType<typeof import("./useSeamlessReel").useSeamlessReel>;
const mount = async () => {
  const latest: { api?: Api } = {};
  const report = (api: Api) => {
    latest.api = api;
  };
  const Probe = () => {
    const api = useSeamlessReel();
    useEffect(() => report(api));
    return createElement("video", { ref: api.videoRef });
  };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  return { latest, unmount: () => act(async () => root.unmount()) };
};
const frag = [{ video: "v.mp4" }] as unknown as Parameters<Api["load"]>[0];

test("読み込みの途中に reset したら、前の回の進み・結果は入らず idle のまま", async () => {
  const view = await mount();
  let pending!: Promise<void>;
  await act(async () => {
    pending = view.latest.api!.load(frag, { progressive: true });
  });
  assert.equal(view.latest.api!.status, "loading");
  await act(async () => view.latest.api!.reset());
  await act(async () => {
    reels[0].opts.onFragmentAppended?.(1, 1);
    reels[0].finish();
    await pending;
  });
  assert.equal(view.latest.api!.status, "idle");
  assert.deepEqual(view.latest.api!.progress, { appended: 0, total: 0 });
  await view.unmount();
});

test("読み込みの途中に次の load をしたら、前の回の失敗は次の回の状態に入らない", async () => {
  const view = await mount();
  let first!: Promise<void>;
  await act(async () => {
    first = view.latest.api!.load(frag);
  });
  await act(async () => {
    void view.latest.api!.load(frag);
  });
  await act(async () => {
    reels[0].opts.onError?.(new Error("old"));
    reels[0].fail(new Error("old"));
    await first.catch(() => {});
  });
  assert.equal(view.latest.api!.status, "loading");
  assert.equal(view.latest.api!.error, null);
  await act(async () => reels[1].finish());
  assert.equal(view.latest.api!.status, "ready");
  await view.unmount();
});
