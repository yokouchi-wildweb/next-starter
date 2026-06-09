// src/features/core/purchaseRequest/services/client/launchers/index.ts
//
// 決済起動レイヤのエントリポイント。
// 起動側 Hook (useCoinPurchase 等) はサーバーから受け取った LaunchInstruction を
// executePaymentLaunch に渡すだけでよい。type に応じて handler が選ばれ、
// リダイレクトや SDK 起動など適切な挙動が走る。
//
// 新しい起動方式 (例: QR ポーリング) を追加する場合は、
//   1. types/payment.ts の LaunchInstruction ユニオンに variant 追加
//   2. 対応する LaunchHandler を実装
//   3. 下のレジストリにエントリ追加
// の 3 ステップで足せる。

"use client";

import type { LaunchInstruction } from "@/features/core/purchaseRequest/types/payment";
import { clientSdkHandler } from "./clientSdkHandler";
import { redirectHandler } from "./redirectHandler";
import type { LaunchContext, LaunchHandler, LaunchResult } from "./types";

export type { LaunchContext, LaunchHandler, LaunchResult } from "./types";

/**
 * LaunchInstruction.type → 対応する LaunchHandler のレジストリ。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const launchHandlers: Record<LaunchInstruction["type"], LaunchHandler<any>> = {
  redirect: redirectHandler,
  client_sdk: clientSdkHandler,
};

/**
 * LaunchInstruction を受けて、対応するハンドラを実行する。
 *
 * - redirect 型: window.location.href にリダイレクト URL を代入する（同期遷移）。
 * - client_sdk 型: SDK モーダルを起動し、authorized なら確定 API → successUrl へ遷移。
 *
 * 戻り値は LaunchResult。呼び元は kind に応じてエラー表示 / cancelUrl 遷移を判断する。
 */
export async function executePaymentLaunch(
  instruction: LaunchInstruction,
  context: LaunchContext,
): Promise<LaunchResult> {
  const handler = launchHandlers[instruction.type];
  if (!handler) {
    return {
      kind: "failed",
      error: new Error(
        `[launch] 起動指示 "${instruction.type}" に対応するハンドラが登録されていません`,
      ),
    };
  }
  return handler.execute(instruction, context);
}
