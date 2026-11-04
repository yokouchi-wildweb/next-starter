// src/featureGate/tools/client/enabled.ts
// useGate().enabled(name): server が渡した { 規則名: 開閉 } を引く。未知の名前は throw(server の gate.enabled と同じ)。
// Provider の外: dev は throw、本番は false

import type { ClientGateState, FeatureName } from "../../types";
import { NO_PROVIDER, outside } from "./outside";

export const enabled = (state: ClientGateState | null, name: FeatureName): boolean => {
  if (state === null) {
    outside(NO_PROVIDER);
    return false;
  }
  if (!Object.hasOwn(state.enabled, name))
    throw new Error(`featureGate: 未知の機能の名前 "${String(name)}"(src/featureGate/rules/<名前>.ts が無い)`);
  return state.enabled[name];
};
