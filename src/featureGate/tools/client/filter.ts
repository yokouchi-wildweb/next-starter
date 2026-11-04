// src/featureGate/tools/client/filter.ts
// useGate().filter(items, getHref?): server の gate.filter と同じ判定(hiddenHref.ts)で、閉じた内部の住所の項目を除く(順は保つ)。
// 範囲の外の内部の住所・Provider の外: dev は throw、本番は除く(閉とみなす)。外部 URL と住所の無い項目は残す

import { isInArea } from "../../area";
import { internalPathname, isHiddenHref } from "../../hiddenHref";
import type { ClientGateState } from "../../types";
import { NO_PROVIDER, outOfArea, outside } from "./outside";

type HrefGetter<T> = (item: T) => string | undefined;

const defaultHref = (item: unknown) => (item as { href?: string | null }).href ?? undefined;

export function filter<T>(state: ClientGateState | null, items: readonly T[], getHref?: HrefGetter<T>): T[] {
  const hrefOf = getHref ?? defaultHref;
  if (state === null) outside(NO_PROVIDER);
  return items.filter((item) => {
    const href = hrefOf(item);
    if (href === undefined) return true;
    const pathname = internalPathname(href);
    if (pathname === null) return true;
    if (state === null) return false;
    if (!isInArea(pathname, state.area)) {
      outside(outOfArea(pathname, state.area));
      return false;
    }
    return !isHiddenHref(href, state.closed);
  });
}
