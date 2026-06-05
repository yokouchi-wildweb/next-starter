// src/features/core/purchaseRequest/services/client/sdkLaunchers/index.ts
//
// JS SDK 型決済プロバイダのクライアントローダーレジストリ。
// LaunchClientSdk.sdkName から対応する SdkLauncher を引いて起動するために使う。
//
// 新規 SDK 型 provider を追加する場合は、ここに { providerName: launcher } を 1 行追加し、
// 別ファイルで SdkLauncher を実装するだけで済む。

"use client";

import { paidySdkLauncher } from "./paidy";
import type { SdkLauncher } from "./types";

export type { SdkLauncher, SdkLaunchOutcome } from "./types";

/**
 * SDK ローダーレジストリ（sdkName → SdkLauncher）
 */
export const sdkLaunchers: Record<string, SdkLauncher> = {
  paidy: paidySdkLauncher,
};

/**
 * sdkName から SdkLauncher を取得する。未登録なら null。
 */
export function getSdkLauncher(sdkName: string): SdkLauncher | null {
  return sdkLaunchers[sdkName] ?? null;
}
