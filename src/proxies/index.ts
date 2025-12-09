import type { ProxyHandler } from './types';
import { featureGateProxy } from './featureGate';
import { redirectProxy } from './redirect';

export const proxyHandlers: ProxyHandler[] = [
  featureGateProxy,  // 機能ゲートを先に実行
  redirectProxy,
];

export type { ProxyHandler } from './types';
