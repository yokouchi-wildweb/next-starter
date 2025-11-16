import type { ProxyHandler } from './types';
import { redirectProxy } from './redirect';

export const proxyHandlers: ProxyHandler[] = [redirectProxy];

export type { ProxyHandler } from './types';
