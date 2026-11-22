// src/proxies/index.ts
// proxy の鎖: 点 proxyHandlers の項目(<ドメイン>/plugs/proxyHandlers/<名前>.ts)を段の閉じた並びで走らせ(D30)、骨組みの段 gate(門番の 404)・
// redirect(転送)をその間に置く。decorator は点 proxyDecorators の項目を <差す側>/<名前> の順に。どれも生成された一覧を門番(gate.plugs)で絞ってから使う
// (閉じたドメインの項目は走らない)。fork はこのファイルを編集しない: 自分のドメインの plugs/proxyHandlers/<名前>.ts に export const handler と
// export const stage を置き、pnpm generate extensions で一覧に入る(宣言 ./extensionPoints.ts)。走査と検査: scripts/structure/extensions/

import { gate } from "@/featureGate";

import { proxyDecorators } from "./extensions/proxyDecorators";
import { proxyHandlers as handlerPlugs } from "./extensions/proxyHandlers";
import { featureGateProxy } from "./featureGate";
import { redirectProxy } from "./redirect";
import type { ProxyHandler, ProxyResponseDecorator } from "./types";

type HandlerEntry = (typeof handlerPlugs)[number];
type Stage = HandlerEntry["stage"];

/** 骨組みの段の handler(項目は選べない段、宣言の skeletonStages) */
const skeleton: Partial<Record<Stage, ProxyHandler>> = {
  gate: featureGateProxy, // 閉じた機能の住所は 404(門番)
  redirect: redirectProxy, // 転送の規則
};

/** 段の並び(宣言の stages と同じ。一覧の項目は生成器がこの順に並べてある) */
const STAGES: readonly Stage[] = ["maintenance", "mode", "gate", "redirect", "main"];

const openHandlers = gate.plugs(handlerPlugs);

/** 鎖の handler(段の順: 項目 → 骨組み → 項目) */
export const proxyHandlers: ProxyHandler[] = STAGES.flatMap((stage) => {
  const own = skeleton[stage];
  return [...(own ? [own] : []), ...openHandlers.filter((entry) => entry.stage === stage).map((entry) => entry.plug)];
});

/**
 * 素通しレスポンス（NextResponse.next()）に副作用を加える decorator(点 proxyDecorators の項目、<差す側>/<名前> の順)。
 * ハンドラーがインターセプトした場合は実行されない。項目どうしは互いに依存しない
 */
export const proxyResponseDecorators: ProxyResponseDecorator[] = gate.plugs(proxyDecorators).map((entry) => entry.plug);

export type { ProxyContext, ProxyHandler, ProxyResponseDecorator } from "./types";
