"use client";

import { useEffect, useState } from "react";

import { APP_HEADER_ELEMENT_ID } from "@/components/AppFrames/constants";

const FALLBACK_INTERVAL_MS = 250;

/**
 * ヘッダーを探す順: 枠の部位の印 data-slot(利用者の枠 header → 管理の枠 admin-header)を先に、id を最後に。
 * id は部品を差し替えて id だけ残した fork のための一時の橋(余白の議会 D12 で枠の部品の id を外す時に一緒に外す)。
 * 部位の名前: src/app/_layout/frame/parts.mjs
 */
export const HEADER_SLOT_SELECTORS = ['[data-slot="header"]', '[data-slot="admin-header"]'] as const;

type HeaderLookup = Pick<Document, "querySelector" | "getElementById">;
type MeasuredElement = Pick<HTMLElement, "getBoundingClientRect" | "isConnected">;

/** ヘッダーの要素(data-slot → id の順)。無ければ null */
export function findHeaderElement(doc: HeaderLookup, elementId: string = APP_HEADER_ELEMENT_ID): MeasuredElement | null {
  for (const selector of HEADER_SLOT_SELECTORS) {
    const element = doc.querySelector(selector);
    if (element) return element as unknown as MeasuredElement;
  }
  return doc.getElementById(elementId);
}

type TrackEnv = {
  doc: HeaderLookup;
  win: Pick<Window, "addEventListener" | "removeEventListener" | "requestAnimationFrame" | "cancelAnimationFrame" | "setInterval" | "clearInterval">;
  /** ResizeObserver を作る(無い環境では null = 一定間隔で測る) */
  createResizeObserver: ((callback: () => void) => Pick<ResizeObserver, "observe" | "disconnect">) | null;
};

/**
 * ヘッダーの高さを追う(hook の中身。document・window・observer は渡す = test が DOM の道具なしで確かめる)。
 * 見つかるまで 1 フレームごとに探し、見つけた要素の大きさの変化と画面幅の変化で測り直す。
 * 測っている要素が DOM から外れたら(ページごとに描き直される行・部品の差し替え)null を返して探し直す。
 * 測った高さが 0(戻る / 進むの付け直しで古い・新しいヘッダーが隠れている間、見つけた直後でまだ描かれていない間)も null = 0 は返さない。
 * null = まだ測れていない(呼び手は inline の値を書かず、styles/core/frame.css の初期値が効く)。枠の宣言で隠したヘッダーの 0 は
 * frame.css の hide の規則(!important)が受け持つので、測った値で 0 を書く必要は無い(fork が自前の CSS で隠すのは対象外: 隠すのは frame.ts)。
 */
export function trackHeaderHeight(onHeight: (height: number | null) => void, elementId: string, { doc, win, createResizeObserver }: TrackEnv): () => void {
  let element: MeasuredElement | null = null;
  let resizeObserver: Pick<ResizeObserver, "observe" | "disconnect"> | null = null;
  let intervalId: number | null = null;
  let animationFrameId: number | null = null;

  const measure = (target: MeasuredElement) => {
    const height = target.getBoundingClientRect().height;
    if (!Number.isFinite(height)) return;
    // 0 は書かない(付け直しの間の 0 が本文をヘッダーの下へ潜らせる。初期値に任せる)
    onHeight(height > 0 ? height : null);
  };

  const detach = () => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (intervalId !== null) win.clearInterval(intervalId);
    intervalId = null;
    element = null;
  };

  const tick = () => {
    if (!element) return;
    if (!element.isConnected) {
      detach();
      onHeight(null);
      ensure();
      return;
    }
    measure(element);
  };

  const attach = (target: MeasuredElement) => {
    element = target;
    measure(target);
    if (createResizeObserver) {
      resizeObserver = createResizeObserver(tick);
      resizeObserver.observe(target as unknown as Element);
    } else {
      intervalId = win.setInterval(tick, FALLBACK_INTERVAL_MS) as unknown as number;
    }
  };

  function ensure() {
    animationFrameId = null;
    const found = findHeaderElement(doc, elementId);
    if (found) attach(found);
    else animationFrameId = win.requestAnimationFrame(ensure);
  }

  win.addEventListener("resize", tick);
  ensure();

  return () => {
    if (animationFrameId !== null) win.cancelAnimationFrame(animationFrameId);
    win.removeEventListener("resize", tick);
    detach();
  };
}

/**
 * ヘッダーの実測の高さ(px)。測る前・探し直している間・高さ 0 の間は null(0 は返さない)。
 * UserLayout は値があるときだけ外枠の inline の --app-header-height に書く(null の間は styles/core/frame.css の
 * 外枠ごと・端末ごとの初期値 = 今の行の高さが効き、測る前の最初の表示とページを移る間も本文がヘッダーに重ならない)。
 * elementId = data-slot で見つからない時に探す id(一時の橋、上の HEADER_SLOT_SELECTORS)
 */
export const useHeaderHeight = (elementId: string = APP_HEADER_ELEMENT_ID): number | null => {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    return trackHeaderHeight(
      (nextHeight) => setHeight((prev) => (prev !== null && nextHeight !== null && Math.abs(prev - nextHeight) < 0.5 ? prev : nextHeight)),
      elementId,
      {
        doc: document,
        win: window,
        createResizeObserver: typeof ResizeObserver !== "undefined" ? (callback) => new ResizeObserver(callback) : null,
      },
    );
  }, [elementId]);

  return height;
};
