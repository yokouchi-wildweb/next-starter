// src/featureGate/tools/client/linkHidden.ts
// リンクを隠すかの判定(道具ではない。束に載せない)。GateProvider が棚の Link の口に差し込み、GatedLink も使う。
// useGate の path / filter と違い throw しない(D14: 範囲の外・Provider の外では出す)。中は hiddenHref.ts の同じ判定

import { isInArea } from "../../area";
import { internalPathname, isHiddenHref } from "../../hiddenHref";
import type { ClientGateState } from "../../types";

export function linkHidden(state: ClientGateState | null, href: string): boolean {
  if (state === null) return false;
  const pathname = internalPathname(href);
  if (pathname === null || !isInArea(pathname, state.area)) return false;
  return isHiddenHref(href, state.closed);
}
