import type { ProxyHandler, ProxyResponseDecorator } from './types';
import { attributionDecorator } from './attribution';
import { inviteLinkDecorator } from './inviteLink';
import { demoModeProxy } from './demoMode';
import { featureGateProxy } from './featureGate';
import { maintenanceProxy } from './maintenance';
import { redirectProxy } from './redirect';

export const proxyHandlers: ProxyHandler[] = [
  maintenanceProxy,  // メンテナンスモードを最優先で実行
  demoModeProxy,     // デモモード（メンテナンスの次に優先）
  featureGateProxy,
  redirectProxy,
];

/**
 * 素通しレスポンス（NextResponse.next()）に副作用を加えるデコレーター。
 * ハンドラーがインターセプトした場合は実行されない。
 */
export const proxyResponseDecorators: ProxyResponseDecorator[] = [
  attributionDecorator, // 流入タッチの cookie 蓄積（解析: ACQUISITION_CONFIG.enabled でゲート）
  inviteLinkDecorator,  // 招待コードの cookie 保存（機能: referral フラグでゲート、解析とは独立）
];

export type { ProxyHandler, ProxyResponseDecorator } from './types';
