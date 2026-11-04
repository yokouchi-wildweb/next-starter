// src/featureGate/tools/client/path.ts
// useGate().path(pathname): server の gate.path と同じ答え(範囲の中)。並びの順で最初に当たった閉じた住所の規則と redirectTo。
// 範囲の外・Provider の外: dev は throw、本番は { open: false, rule: null }

import { matchesPath } from "@/lib/pathPattern/index.mjs";

import { isInArea } from "../../area";
import type { ClientGatePathResult, ClientGateState } from "../../types";
import { NO_PROVIDER, outOfArea, outside } from "./outside";

export const path = (state: ClientGateState | null, pathname: string): ClientGatePathResult => {
  if (state === null) {
    outside(NO_PROVIDER);
    return { open: false, rule: null };
  }
  if (!isInArea(pathname, state.area)) {
    outside(outOfArea(pathname, state.area));
    return { open: false, rule: null };
  }
  const hit = state.closed.find((entry) => matchesPath(pathname, entry.pattern));
  if (!hit) return { open: true };
  // server の gate.path と同じ形(redirectTo の鍵を常に持つ)
  return { open: false, rule: hit.rule, redirectTo: hit.redirectTo };
};
