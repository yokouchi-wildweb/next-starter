import type { ProxyHandler, ProxyResponseDecorator } from './types';
import { attributionDecorator } from './attribution';
import { inviteLinkDecorator } from './inviteLink';
import { demoModeProxy } from './demoMode';
import { featureGateProxy } from './featureGate';
import { maintenanceProxy } from './maintenance';
import { redirectProxy } from './redirect';
import { decorators as extensionDecorators } from './extensions/decorators';
import { handlers as extensionHandlers } from './extensions/handlers';

// 骨組み(上流の手書き)+ 枠(生成一覧)。fork はこのファイルを編集しない:
// src/proxies/<名前>.<fork ID>.ts に export const handler / decorator を置き、pnpm extensions:generate で枠に入る(宣言 ./extensionPoints.ts)。
// 枠の項目は骨組みの後ろでファイル名の順に走る(Tier 順は使わない)。項目どうしは互いに依存しない。
// 骨組みより前に走らせたい項目は作らない(要るなら上流へ依頼し、骨組みに吸収する)。走査と検査: scripts/extensions/

/** 骨組みの handler(順序に意味がある) */
const skeletonHandlers: ProxyHandler[] = [
  maintenanceProxy,  // メンテナンスモードを最優先で実行
  demoModeProxy,     // デモモード（メンテナンスの次に優先）
  featureGateProxy,
  redirectProxy,
];

/**
 * 素通しレスポンス（NextResponse.next()）に副作用を加える骨組みのデコレーター。
 * ハンドラーがインターセプトした場合は実行されない。
 */
const skeletonDecorators: ProxyResponseDecorator[] = [
  attributionDecorator, // 流入タッチの cookie 蓄積（解析: ACQUISITION_CONFIG.enabled でゲート）
  inviteLinkDecorator,  // 招待コードの cookie 保存（機能: referral フラグでゲート、解析とは独立）
];

export const proxyHandlers: ProxyHandler[] = [...skeletonHandlers, ...extensionHandlers];

export const proxyResponseDecorators: ProxyResponseDecorator[] = [...skeletonDecorators, ...extensionDecorators];

export type { ProxyContext, ProxyHandler, ProxyResponseDecorator } from './types';
