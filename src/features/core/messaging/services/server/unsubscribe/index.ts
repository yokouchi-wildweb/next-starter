// src/features/core/messaging/services/server/unsubscribe/index.ts
//
// ワンクリックの配信停止(トークン・記録)。受け口 /api/messaging/unsubscribe と送る口(停止の URL)が読む。

import { recordOneClickUnsubscribe, type OneClickResult } from "./recordOneClick";
import { drizzleOneClickStore } from "./store";
import type { UnsubscribeTokenPayload } from "./token";

/** ワンクリックの停止を記録する(何度届いても同じ結果) */
export function recordUnsubscribe(payload: UnsubscribeTokenPayload): Promise<OneClickResult> {
  return recordOneClickUnsubscribe(drizzleOneClickStore, payload);
}

export {
  UNSUBSCRIBE_PATH,
  UNSUBSCRIBE_SECRET_ENV,
  buildUnsubscribeUrl,
  isUnsubscribeConfigured,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  type UnsubscribeTokenPayload,
} from "./token";
export { recordOneClickUnsubscribe, type OneClickResult, type OneClickStore } from "./recordOneClick";
