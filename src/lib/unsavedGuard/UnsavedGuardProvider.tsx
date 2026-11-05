// src/lib/unsavedGuard/UnsavedGuardProvider.tsx
// 守りの Provider と hook(入口 ./index.ts からだけ読む)。next/navigation の useRouter を読むのはこのファイルだけ(lint router-via-guard の例外)

"use client";

import { useRouter as useNextRouter, usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

import { createUnsavedGuard, type UnsavedGuard } from "./guard";
import type { ConfirmLeave, GuardedRouter, LinkNavigateJudge, UnsavedSource } from "./types";

type GuardContextValue = { guard: UnsavedGuard; raw: ReturnType<typeof useNextRouter> };

const GuardContext = createContext<GuardContextValue | null>(null);

/**
 * 守りを置く。confirm = 確認を出す関数(値。アプリの既定は src/wiring の Dialog)。
 * Provider の外では守らない(hook は素の Next の動きになる)
 */
export function UnsavedGuardProvider({ confirm, children }: Readonly<{ confirm: ConfirmLeave; children: ReactNode }>) {
  const raw = useNextRouter();
  // 守りは 1 度だけ作り、確認の関数と素の router は描画の後に最新を入れる
  const [guard] = useState(() => createUnsavedGuard({ env: () => ({ win: window, doc: document }) as never }));
  useLayoutEffect(() => {
    guard.configure({ confirm, router: raw });
  });
  const pathname = usePathname();
  useEffect(() => {
    guard.navigated();
  }, [guard, pathname]);
  const value = useMemo(() => ({ guard, raw }), [guard, raw]);
  return <GuardContext.Provider value={value}>{children}</GuardContext.Provider>;
}

/** 編集済みの間(when = true)守る。フォームなら formState.isDirty を渡す */
export function useUnsavedGuard(when: boolean): void {
  const source = useUnsavedSource();
  useEffect(() => {
    source.set(when);
  }, [source, when]);
}

const noopSource: UnsavedSource = { set: () => {}, dispose: () => {} };

/** 編集済みの元を 1 つ作る(set を同期に呼べる。送信の直前に外すなど)。unmount で外れる */
export function useUnsavedSource(): UnsavedSource {
  const context = useContext(GuardContext);
  const source = useMemo(() => context?.guard.createSource() ?? noopSource, [context]);
  useEffect(() => () => source.dispose(), [source]);
  return source;
}

/** next/navigation の useRouter と同じ形。push / replace / back / forward は編集済みの間に確認する(Provider の外は素の router) */
export function useRouter(): GuardedRouter {
  const context = useContext(GuardContext);
  const fallback = useNextRouter();
  return useMemo(() => {
    if (!context) return fallback;
    const { guard } = context;
    const raw = () => context.raw;
    return {
      push: (href, options) => void guard.request({ kind: "push", href }, () => raw().push(href, options)),
      replace: (href, options) => void guard.request({ kind: "replace", href }, () => raw().replace(href, options)),
      back: () => void guard.request({ kind: "back" }, () => guard.back(() => raw().back())),
      forward: () => void guard.request({ kind: "forward" }, () => raw().forward()),
      refresh: () => raw().refresh(),
      prefetch: (href) => raw().prefetch(href),
    };
  }, [context, fallback]);
}

/** 編集済みの元の作り方(src/wiring が棚の口へ入れる。Provider の外は何もしない元) */
export function useUnsavedSourceFactory(): () => UnsavedSource {
  const context = useContext(GuardContext);
  return useMemo(() => (context ? () => context.guard.createSource() : () => noopSource), [context]);
}

const passLink: LinkNavigateJudge = () => undefined;

/** 棚の Link の onNavigate に渡す判定(src/wiring が棚の Navigation の口へ入れる) */
export function useLinkNavigateJudge(): LinkNavigateJudge {
  const context = useContext(GuardContext);
  return context ? context.guard.judgeLink : passLink;
}
