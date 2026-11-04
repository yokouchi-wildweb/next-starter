// src/featureGate/client.ts
// 門番の client の入口。client は規則を評価せず、server が計算して渡した値(clientGateState)だけを読む(D5)。
// - useGate(): enabled(name)・path(pathname)・filter(items, getHref?)。範囲の外の住所・Provider の外は dev で throw、本番は閉
// - GateProvider: 配線用(L1.7)。src/wiring/AppProviders.tsx と admin の守りの layout 2 つだけ(lint feature-gate-entries)
// 詳細: ./README.md

export { GateProvider, useGate, type ClientGate } from "./tools/client/GateProvider";
export type { ClientGateArea, ClientGatePathResult, ClientGateState, FeatureName } from "./types";
