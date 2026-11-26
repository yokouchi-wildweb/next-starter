// src/lib/frameDims/frameRoot.ts — 枠が自分の外枠の要素を登録する口(D92)。測る側(useFrameDimsStyle)は登録した物だけを測る
// (文書の最初の [data-frame-root] を探さない: 隠れた枠・登録しない fork の自前の枠の寸法を拾わない)

"use client";

import type { RefCallback } from "react";

/** 登録した外枠(登録した順) */
const roots: Element[] = [];
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

/** 外枠を登録し、外す関数を返す(同じ要素の 2 度目は最後に登録した物として並べ直す) */
export function registerFrameRoot(element: Element): () => void {
  const at = roots.indexOf(element);
  if (at >= 0) roots.splice(at, 1);
  roots.push(element);
  notify();
  return () => {
    const index = roots.indexOf(element);
    if (index < 0) return;
    roots.splice(index, 1);
    notify();
  };
}

/** 測る相手 = 登録されていて今つながっている中で最後に登録した外枠。無ければ null */
export function currentFrameRoot(): Element | null {
  for (let i = roots.length - 1; i >= 0; i -= 1) {
    const root = roots[i];
    if (!("isConnected" in root) || root.isConnected) return root;
  }
  return null;
}

/** 登録の出入りを見る */
export function subscribeFrameRoots(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 外枠の要素に付ける ref(mount で登録、unmount で外す。React 19 の ref の片付け) */
const frameRootRef: RefCallback<HTMLElement> = (element) => (element ? registerFrameRoot(element) : undefined);

/**
 * 枠(UserLayout・AdminLayout・fork の自前の枠)が外枠の要素に付ける ref。付けた枠の寸法だけを useFrameDimsStyle が測る。
 * ```tsx
 * <Flex data-frame-root="" ref={useFrameRootRef()}>…</Flex>
 * ```
 */
export function useFrameRootRef(): RefCallback<HTMLElement> {
  return frameRootRef;
}
