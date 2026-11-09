// src/featureGate/index.ts
// 門番の入口(server・proxy)。公開名は名前空間 gate・配線用の clientGateState・型だけ(中の判定 isFeatureEnabled・resolvePath は出さない)。
// 使い方: gate.enabled("wallet") / gate.assert("wallet")(閉なら 404 の DomainError) / gate.path(pathname) / gate.filter(items, getHref?)。client は client.ts、道具(scripts・test)は node.ts。詳細: ./README.md

import { serverTools } from "./tools/server";

export const gate = serverTools;

/** client に渡す値の計算(配線用、L1.7)。root layout・AppProviders・admin の守りの layout だけ(lint feature-gate-entries) */
export { clientGateState } from "./clientState";

export type {
  AlwaysOnException,
  ClientGateArea,
  ClientGatePathResult,
  ClientGateState,
  DependencyException,
  FeatureGateRule,
  FeatureName,
  FeatureSwitches,
  GatedCronTask,
  GatedDomain,
  GatedFeatureRule,
  GatedSettingSection,
  GeneratedFeatureRule,
  GatePathResult,
  RequiredFeature,
} from "./types";
