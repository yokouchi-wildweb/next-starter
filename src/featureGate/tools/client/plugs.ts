// src/featureGate/tools/client/plugs.ts
// useGate().plugs(items): server の gate.plugs と同じ判定を、server が渡した閉じたドメインの並び(ClientGateState.closedDomains)で(順は保つ)。
// 項目のドメインか requires の相手のどれかが閉じていれば外す、domain null(lib の項目)は外さない。Provider の外: dev は throw、本番は domain のある項目を外す(閉とみなす)

import type { ClientGateState, GatedPlug } from "../../types";
import { NO_PROVIDER, outside } from "./outside";

export function plugs<T extends GatedPlug>(state: ClientGateState | null, items: readonly T[]): T[] {
  if (state === null) outside(NO_PROVIDER);
  const closed = new Set(state?.closedDomains ?? []);
  const open = (domain: string) => state !== null && !closed.has(domain);
  return items.filter((item) => item.domain === null || (open(item.domain) && item.requires.every(open)));
}
