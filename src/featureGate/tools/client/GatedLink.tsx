// src/featureGate/tools/client/GatedLink.tsx
// GatedLink: 門番の client 入口のリンク。棚の Link と同じ判定(linkHidden.ts)で閉じた機能の住所を描かない。
// 棚の口の差し込みに依らない(自分で口を包み直す)ので、口を別の判定で包んだ場所の中でも門番の判定で隠す。
// server component の中から使ってよい(Provider の中で SSR され判定が効く。server 版は作らない: L1.8)

"use client";

import { useCallback } from "react";

import { Link, LinkVisibilityProvider, type LinkProps } from "@/components/Navigation/Link";

import { useGateState } from "./GateProvider";
import { linkHidden } from "./linkHidden";

export type GatedLinkProps = Omit<LinkProps, "gate">;

export function GatedLink(props: GatedLinkProps) {
  const state = useGateState();
  const isHidden = useCallback((href: string) => linkHidden(state, href), [state]);
  return (
    <LinkVisibilityProvider isHidden={isHidden}>
      <Link {...props} gate="auto" />
    </LinkVisibilityProvider>
  );
}
