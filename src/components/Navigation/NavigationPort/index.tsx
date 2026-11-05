// src/components/Navigation/NavigationPort/index.tsx
// 棚の Navigation の口(1 つ): 移動の判定(Link の onNavigate)と router と編集済みの元の作り方を、外から差し込む文脈。
// 棚は守りの lib を知らない(D50): アプリでは src/wiring が未保存の編集の守り(src/lib/unsavedGuard)をここへ入れる。
// 門番の口(Link の LinkVisibilityProvider)とは別(役目を混ぜない)。
// 口の外(Provider なし)= 何も守らない: Link は素の next/link、useShelfRouter は住所の移動だけの router(既定。Provider の中では使われない)

"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";

/** next/navigation の router と同じ形 */
export type ShelfRouter = {
  readonly push: (href: string, options?: { scroll?: boolean }) => void;
  readonly replace: (href: string, options?: { scroll?: boolean }) => void;
  readonly back: () => void;
  readonly forward: () => void;
  readonly refresh: () => void;
  readonly prefetch: (href: string) => void;
};

/** Link の onNavigate の判定(undefined = 何もしない) */
export type ShelfLinkJudge = (href: string, options: { readonly replace: boolean; readonly scroll: boolean }) => ((event: { preventDefault: () => void }) => void) | undefined;

/** 編集済みの元 1 つ(set(true) の間は守る) */
export type ShelfUnsavedSource = { readonly set: (active: boolean) => void; readonly dispose: () => void };

export type NavigationPortValue = {
  /** 棚の部品が使う router(null = 口の外) */
  readonly router: ShelfRouter | null;
  readonly judgeLink: ShelfLinkJudge;
  /** Link が描く <a> に足す属性(守りが Link の <a> を見分ける印など) */
  readonly linkAttributes: Readonly<Record<string, string>>;
  readonly createUnsavedSource: () => ShelfUnsavedSource;
};

const noopSource: ShelfUnsavedSource = { set: () => {}, dispose: () => {} };

const DEFAULT_PORT: NavigationPortValue = {
  router: null,
  judgeLink: () => undefined,
  linkAttributes: {},
  createUnsavedSource: () => noopSource,
};

const NavigationPortContext = createContext<NavigationPortValue>(DEFAULT_PORT);

export function NavigationPortProvider({ value, children }: Readonly<{ value: NavigationPortValue; children: ReactNode }>) {
  return <NavigationPortContext.Provider value={value}>{children}</NavigationPortContext.Provider>;
}

export const useNavigationPort = (): NavigationPortValue => useContext(NavigationPortContext);

/** 口の外の router(住所の移動だけ。アプリでは口の router が使われる) */
const locationRouter: ShelfRouter = {
  push: (href) => window.location.assign(href),
  replace: (href) => window.location.replace(href),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => window.location.reload(),
  prefetch: () => {},
};

/** 棚の部品が移動に使う router(口の router。アプリでは編集済みの間に確認する守り付き) */
export function useShelfRouter(): ShelfRouter {
  return useNavigationPort().router ?? locationRouter;
}

/** 編集済みの元を 1 つ作る(AppForm など)。unmount で外れる。set は同期に呼べる */
export function useShelfUnsavedSource(): ShelfUnsavedSource {
  const port = useNavigationPort();
  const source = useMemo(() => port.createUnsavedSource(), [port]);
  useEffect(() => () => source.dispose(), [source]);
  return source;
}
