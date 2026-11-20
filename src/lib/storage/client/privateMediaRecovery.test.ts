// src/lib/storage/client/privateMediaRecovery.test.ts
// usePrivateMediaRecovery の先回り再読み込みの判定（isSignedReadStale）・再取得 query の単体テストと、
// videoProps を <video> に広げたときに個別の handle* を配線したときと同じ復帰をたどるかの検査（jsdom の上で描く）。
// 先回りの読み直し（loadstart からの経過 + play / seeking）の実時間の振る舞いはブラウザで確かめる。
// 実行: pnpm test src/lib/storage/client/privateMediaRecovery.test.ts

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import { storageConfig } from "../config";

import { createElement, type ReactElement } from "react";
import { JSDOM } from "jsdom";

import {
  isSignedReadStale,
  PROACTIVE_RELOAD_MARGIN_SEC,
  withMediaRetryQuery,
  type PrivateMediaRecovery,
} from "./usePrivateMediaRecovery";

describe("先回り再読み込みの判定", () => {
  const ttl = storageConfig.readTtlSec.video;
  const start = 1_000_000;

  test("読み込み開始から TTL − 30 秒に届かなければ読み直さない", () => {
    assert.equal(isSignedReadStale(start, start + (ttl - PROACTIVE_RELOAD_MARGIN_SEC) * 1000 - 1, ttl), false);
  });

  test("TTL − 30 秒以降（期限後も）は読み直す", () => {
    assert.equal(isSignedReadStale(start, start + (ttl - PROACTIVE_RELOAD_MARGIN_SEC) * 1000, ttl), true);
    assert.equal(isSignedReadStale(start, start + ttl * 1000 + 60_000, ttl), true);
  });

  test("読み込みが始まっていなければ読み直さない", () => {
    assert.equal(isSignedReadStale(null, start, ttl), false);
  });

  test("TTL が余白より短いときは開始直後から読み直す扱い（0 秒で打ち切り）", () => {
    assert.equal(isSignedReadStale(start, start, 20), true);
  });

  test("TTL 60 秒（S5 の試験値）なら 30 秒で読み直す", () => {
    assert.equal(isSignedReadStale(start, start + 29_999, 60), false);
    assert.equal(isSignedReadStale(start, start + 30_000, 60), true);
  });
});

test("再取得 query は既存の query を残して付け足す", () => {
  assert.equal(withMediaRetryQuery("/api/storage/objects/x", 1), "/api/storage/objects/x?_r=1");
  assert.equal(withMediaRetryQuery("/api/storage/objects/x?a=1", 2), "/api/storage/objects/x?a=1&_r=2");
});

// ---- videoProps(jsdom の上で描く) ----

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

const PRIVATE_SRC = "/api/storage/objects/abc";

let act: typeof import("react").act;
let useRef: typeof import("react").useRef;
let createRoot: typeof import("react-dom/client").createRoot;
let usePrivateMediaRecovery: typeof import("./usePrivateMediaRecovery").usePrivateMediaRecovery;
before(async () => {
  ({ act, useRef } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ usePrivateMediaRecovery } = await import("./usePrivateMediaRecovery"));
});
after(() => dom.window.close());

type Wiring = "spread" | "handlers";

/** hook の返り値を外へ出しながら <video> を 1 つ描く。spread = videoProps を広げる / handlers = handle* を 1 つずつ渡す */
function mount(wiring: Wiring, src: string) {
  const seen: PrivateMediaRecovery[] = [];
  function Player({ at }: { at: string }): ReactElement {
    const ref = useRef<HTMLVideoElement>(null);
    const recovery = usePrivateMediaRecovery(at, ref);
    seen.push(recovery);
    if (wiring === "spread") return createElement("video", { ref, ...recovery.videoProps });
    return createElement("video", {
      ref,
      src: recovery.src,
      onError: recovery.handleError,
      onLoadedMetadata: recovery.handleLoadedMetadata,
      onCanPlay: recovery.handleCanPlay,
      onLoadStart: recovery.handleLoadStart,
      onPlay: recovery.handlePlaybackIntent,
      onSeeking: recovery.handlePlaybackIntent,
    });
  }
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(Player, { at: src })));
  const video = () => host.querySelector("video") as unknown as HTMLVideoElement;
  const fire = (type: string) => act(() => void video().dispatchEvent(new dom.window.Event(type)));
  const rerender = () => act(() => root.render(createElement(Player, { at: src })));
  const latest = () => seen[seen.length - 1];
  const unmount = () => act(() => root.unmount());
  return { video, fire, rerender, latest, unmount };
}

/** 失敗 → 復帰中 → 再生できる → 失敗 → 復帰中 → 失敗 → 止まる、の各段の (status, 要素の src に再取得 query があるか) */
function walk(wiring: Wiring): [string, boolean][] {
  const m = mount(wiring, PRIVATE_SRC);
  const snap = (): [string, boolean] => [m.latest().status, (m.video().getAttribute("src") ?? "").includes("_r=")];
  const steps: [string, boolean][] = [snap()];
  for (const type of ["error", "canplay", "error", "error"]) {
    m.fire(type);
    steps.push(snap());
  }
  m.unmount();
  return steps;
}

describe("videoProps", () => {
  test("広げた <video> は個別の handle* を配線したときと同じ復帰をたどる(1 回目の失敗で読み直し、続けて失敗したら failed)", () => {
    const spread = walk("spread");
    assert.deepEqual(spread, walk("handlers"));
    assert.deepEqual(spread, [
      ["idle", false],
      ["recovering", true],
      ["idle", true],
      ["recovering", true],
      ["failed", true],
    ]);
  });

  test("src と 6 つのイベントだけを持ち、onPlay・onSeeking は handlePlaybackIntent、同じ src の間は同じ参照", () => {
    const m = mount("spread", PRIVATE_SRC);
    const first = m.latest();
    assert.deepEqual(Object.keys(first.videoProps).sort(), ["onCanPlay", "onError", "onLoadStart", "onLoadedMetadata", "onPlay", "onSeeking", "src"]);
    assert.equal(first.videoProps.src, PRIVATE_SRC);
    assert.equal(first.videoProps.onError, first.handleError);
    assert.equal(first.videoProps.onLoadedMetadata, first.handleLoadedMetadata);
    assert.equal(first.videoProps.onCanPlay, first.handleCanPlay);
    assert.equal(first.videoProps.onLoadStart, first.handleLoadStart);
    assert.equal(first.videoProps.onPlay, first.handlePlaybackIntent);
    assert.equal(first.videoProps.onSeeking, first.handlePlaybackIntent);
    m.rerender();
    assert.equal(m.latest().videoProps, first.videoProps);
    m.unmount();
  });

  test("固定 URL でない src は失敗しても読み直さない(広げても同じ)", () => {
    const m = mount("spread", "https://cdn.example.com/v.mp4");
    m.fire("error");
    assert.equal(m.latest().status, "idle");
    assert.equal(m.video().getAttribute("src"), "https://cdn.example.com/v.mp4");
    m.unmount();
  });
});
