// src/features/core/purchaseRequest/services/client/launchers/clientSdkHandler.ts
//
// "client_sdk" 型の LaunchInstruction を処理するハンドラ。
// 流れ:
//   1. sdkLaunchers[sdkName] を取得
//   2. load() → launch(config) でモーダル決済を実施
//   3. authorized なら確定 API (/api/wallet/purchase/[id]/[sdkName]/confirm) を
//      keepalive 付き fetch で発火し、待たずに即 successUrl (= callback 画面) へ遷移する。
//      確定処理はサーバー側で進行し、callback 画面の usePurchaseStatusPolling が
//      purchase_request.status を監視して completed / failed への遷移を検知する。
//      これにより redirect 型と SDK 型の UX が統一される（ローディング体感の差が無くなる）。

"use client";

import type { LaunchClientSdk } from "@/features/core/purchaseRequest/types/payment";
import { getSdkLauncher } from "../sdkLaunchers";
import type { LaunchContext, LaunchHandler, LaunchResult } from "./types";

export const clientSdkHandler: LaunchHandler<LaunchClientSdk> = {
  async execute(
    instruction: LaunchClientSdk,
    context: LaunchContext,
  ): Promise<LaunchResult> {
    const launcher = getSdkLauncher(instruction.sdkName);
    if (!launcher) {
      return {
        kind: "failed",
        error: new Error(
          `[client_sdk] sdkName "${instruction.sdkName}" のローダーが未登録です`,
        ),
      };
    }

    try {
      await launcher.load();
    } catch (e) {
      return {
        kind: "failed",
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }

    let outcome;
    try {
      outcome = await launcher.launch(instruction.config);
    } catch (e) {
      return {
        kind: "failed",
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }

    if (outcome.status === "closed") {
      return { kind: "closed", rawResult: outcome.rawResult };
    }
    if (outcome.status === "rejected") {
      return {
        kind: "rejected",
        reason: outcome.reason,
        rawResult: outcome.rawResult,
      };
    }

    // authorized:
    //   1. 確定 API を keepalive 付き fetch で発火（await しない）。keepalive はページ遷移後も
    //      リクエストの送信を継続させる Fetch API 標準オプション。Beacon と同じ仕組み。
    //   2. 即座に successUrl（callback 画面）へ遷移。サーバー側で確定処理が進む間、
    //      callback 画面の usePurchaseStatusPolling が purchase_request.status を監視する。
    //   3. 確定 API の失敗は purchase_request.status へ書き戻されるため、ポーリングが
    //      最終的に検知する。Webhook が登録されていれば Webhook 経由でも救済される。
    const confirmUrl = `/api/wallet/purchase/${encodeURIComponent(context.purchaseRequestId)}/${encodeURIComponent(instruction.sdkName)}/confirm`;
    try {
      // void で明示的に Promise を捨てる。await しないことが意図であることを示す。
      void fetch(confirmUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerPaymentId: outcome.providerPaymentId }),
        keepalive: true,
        credentials: "same-origin",
      }).catch((e) => {
        // ページ遷移後はユーザーは見ないが、開発時のデバッグ用にコンソールには出す。
        console.error("[clientSdkHandler] confirm API fetch error:", e);
      });
    } catch (e) {
      // fetch そのものが同期 throw するケース（URL 不正等）の防御
      return {
        kind: "failed",
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }

    if (context.successUrl) {
      window.location.href = context.successUrl;
    }

    return { kind: "redirected" };
  },
};
