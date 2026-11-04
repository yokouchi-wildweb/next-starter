// src/featureGate/tools/client/GateProvider.tsx
// client の受け渡し: server が計算した値(clientGateState)を文脈に置く Provider と、それを読む useGate。
// GateProvider は配線用(L1.7): src/wiring/AppProviders.tsx(利用者の枠)と admin の守りの layout 2 つ(管理の枠で包み直す)だけ(lint)

"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import type { ClientGatePathResult, ClientGateState, FeatureName } from "../../types";
import { clientTools } from "./index";

const GateContext = createContext<ClientGateState | null>(null);

export function GateProvider({ state, children }: Readonly<{ state: ClientGateState; children: ReactNode }>) {
  return <GateContext.Provider value={state}>{children}</GateContext.Provider>;
}

type HrefGetter<T> = (item: T) => string | undefined;

/** useGate() の返り値(server の gate と同じ名前。assert は server だけ) */
export type ClientGate = {
  /** 機能が有効か。未知の名前は throw */
  enabled: (name: FeatureName) => boolean;
  /** 住所が開いているか(範囲の中は server の gate.path と同じ答え) */
  path: (pathname: string) => ClientGatePathResult;
  /** 閉じた内部の住所の項目を除く(既定は item.href。href を持たない型は getHref が必須) */
  filter: {
    <T extends { href?: string | null }>(items: readonly T[], getHref?: HrefGetter<T>): T[];
    <T>(items: readonly T[], getHref: HrefGetter<T>): T[];
  };
};

export function useGate(): ClientGate {
  const state = useContext(GateContext);
  return useMemo(
    () => ({
      enabled: (name: FeatureName) => clientTools.enabled(state, name),
      path: (pathname: string) => clientTools.path(state, pathname),
      filter: <T,>(items: readonly T[], getHref?: HrefGetter<T>) => clientTools.filter(state, items, getHref),
    }),
    [state],
  );
}
