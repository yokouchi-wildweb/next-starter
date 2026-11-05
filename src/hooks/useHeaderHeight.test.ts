// src/hooks/useHeaderHeight.test.ts — pnpm test:frame-dims
// ヘッダーの探し方(data-slot が先、id は最後の一時の橋)と、差し替わった要素を探し直して測ることを、DOM の道具なしの偽物で確かめる
import { test } from "node:test";
import assert from "node:assert/strict";

import { HEADER_SLOT_SELECTORS, findHeaderElement, trackHeaderHeight } from "./useHeaderHeight";

type FakeElement = { isConnected: boolean; height: number; getBoundingClientRect: () => { height: number } };
const element = (height: number): FakeElement => {
  const el: FakeElement = { isConnected: true, height, getBoundingClientRect: () => ({ height: el.height }) };
  return el;
};

/** querySelector / getElementById を持つ偽の document(slots: data-slot の名前 → 要素、ids: id → 要素) */
function fakeDoc(slots: Record<string, FakeElement> = {}, ids: Record<string, FakeElement> = {}) {
  return {
    slots,
    ids,
    querySelector: (selector: string) => {
      const name = /^\[data-slot="([^"]+)"\]$/.exec(selector)?.[1];
      return (name && slots[name]) || null;
    },
    getElementById: (id: string) => ids[id] ?? null,
  };
}

/** window と ResizeObserver の偽物(フレームと大きさの変化を手で起こす) */
function fakeEnv(doc: ReturnType<typeof fakeDoc>) {
  const frames: (() => void)[] = [];
  const observers: { callback: () => void; targets: unknown[]; disconnected: boolean }[] = [];
  const listeners = new Map<string, () => void>();
  return {
    frames,
    observers,
    listeners,
    flush: () => frames.splice(0).forEach((fn) => fn()),
    env: {
      doc: doc as never,
      win: {
        addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
        removeEventListener: (type: string) => listeners.delete(type),
        requestAnimationFrame: (fn: () => void) => frames.push(fn),
        cancelAnimationFrame: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
      } as never,
      createResizeObserver: (callback: () => void) => {
        const observer = { callback, targets: [] as unknown[], disconnected: false };
        observers.push(observer);
        return { observe: (target: unknown) => observer.targets.push(target), disconnect: () => (observer.disconnected = true) } as never;
      },
    },
  };
}

test("探す順: data-slot header → admin-header → id(一時の橋)", () => {
  const user = element(56);
  const admin = element(60);
  const byId = element(40);
  assert.deepEqual([...HEADER_SLOT_SELECTORS], ['[data-slot="header"]', '[data-slot="admin-header"]']);
  assert.equal(findHeaderElement(fakeDoc({ header: user }, { header: byId }) as never), user);
  assert.equal(findHeaderElement(fakeDoc({ "admin-header": admin }, { header: byId }) as never), admin);
  assert.equal(findHeaderElement(fakeDoc({}, { header: byId }) as never), byId, "data-slot が無い差し替え部品は id で");
  assert.equal(findHeaderElement(fakeDoc({}, { mine: byId }) as never, "mine"), byId);
  assert.equal(findHeaderElement(fakeDoc() as never), null);
});

test("id を外して data-slot だけ残したヘッダーも測る(既定のヘッダーは data-slot と id が同じ要素なので値は今と同じ)", () => {
  const header = element(56);
  const fake = fakeEnv(fakeDoc({ header }));
  const heights: (number | null)[] = [];
  trackHeaderHeight((h) => heights.push(h), "header", fake.env);
  assert.deepEqual(heights, [56]);
  header.height = 0;
  fake.observers[0].callback();
  assert.deepEqual(heights, [56, 0], "隠すと 0");
});

test("見つかるまでフレームごとに探し、見つけたら測って ResizeObserver で追う", () => {
  const doc = fakeDoc();
  const fake = fakeEnv(doc);
  const heights: (number | null)[] = [];
  trackHeaderHeight((h) => heights.push(h), "header", fake.env);
  assert.deepEqual(heights, [], "見つかるまで何も返さない(hook は null のまま)");
  fake.flush();
  doc.slots["admin-header"] = element(60);
  fake.flush();
  assert.deepEqual(heights, [60]);
  doc.slots["admin-header"].height = 88;
  fake.observers[0].callback();
  assert.deepEqual(heights, [60, 88], "後からの高さの変化");
});

test("測っている要素が DOM から外れたら null(まだ測れていない)にして探し直し、差し替わった要素を測る", () => {
  const first = element(60);
  const doc = fakeDoc({ "admin-header": first });
  const fake = fakeEnv(doc);
  const heights: (number | null)[] = [];
  const stop = trackHeaderHeight((h) => heights.push(h), "header", fake.env);
  const second = element(72);
  first.isConnected = false;
  doc.slots["admin-header"] = second;
  fake.observers[0].callback();
  assert.equal(fake.observers[0].disconnected, true);
  assert.deepEqual(heights, [60, null, 72]);
  assert.deepEqual(fake.observers[1].targets, [second]);
  fake.listeners.get("resize")?.();
  assert.deepEqual(heights, [60, null, 72, 72], "画面幅の変化でも測り直す");
  stop();
  assert.equal(fake.observers[1].disconnected, true);
  assert.equal(fake.listeners.has("resize"), false);
});

test("外れた後に見つからなければ null のまま、フレームごとに探す", () => {
  const first = element(52);
  const doc = fakeDoc({ "admin-header": first });
  const fake = fakeEnv(doc);
  const heights: (number | null)[] = [];
  trackHeaderHeight((h) => heights.push(h), "header", fake.env);
  first.isConnected = false;
  delete doc.slots["admin-header"];
  fake.observers[0].callback();
  fake.flush();
  assert.deepEqual(heights, [52, null]);
  doc.slots["admin-header"] = element(88);
  fake.flush();
  assert.deepEqual(heights, [52, null, 88]);
});
