// src/components/Navigation/Link/context.tsx
// 棚の Link の口: 「この href を隠すか」の判定を差し込む文脈。既定 = 何も隠さない(棚は門番を知らない)。
// アプリでは門番(src/featureGate の GateProvider)が閉じた機能の住所の判定をここへ差し込む

"use client";

import { createContext, type ReactNode, useContext } from "react";

/** href(文字列。UrlObject は pathname)を受けて隠すなら true */
export type LinkHiddenJudge = (href: string) => boolean;

const showAll: LinkHiddenJudge = () => false;

const LinkVisibilityContext = createContext<LinkHiddenJudge>(showAll);

export function LinkVisibilityProvider({ isHidden, children }: Readonly<{ isHidden: LinkHiddenJudge; children: ReactNode }>) {
  return <LinkVisibilityContext.Provider value={isHidden}>{children}</LinkVisibilityContext.Provider>;
}

export const useLinkHiddenJudge = (): LinkHiddenJudge => useContext(LinkVisibilityContext);
