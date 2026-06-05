// src/features/core/purchaseRequest/services/client/launchers/clientSdkHandler.ts
//
// "client_sdk" 型の LaunchInstruction を処理するハンドラ。
// 流れ:
//   1. sdkLaunchers[sdkName] を取得
//   2. load() → launch(config) でモーダル決済を実施
//   3. authorized なら確定 API (/api/wallet/purchase/[id]/[sdkName]/confirm) を叩く
//   4. 確定 API 成功なら successUrl に遷移、失敗 / closed なら呼び元判断

"use client";

import axios from "axios";

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

    // authorized: 確定 API を叩く
    const confirmUrl = `/api/wallet/purchase/${encodeURIComponent(context.purchaseRequestId)}/${encodeURIComponent(instruction.sdkName)}/confirm`;
    try {
      await axios.post(confirmUrl, {
        providerPaymentId: outcome.providerPaymentId,
      });
    } catch (e) {
      // 確定 API 失敗。Webhook での確定にフォールバックする想定で、purchase 自体は救えるが、
      // クライアント側ではエラーを返して呼び元に判断させる。
      return {
        kind: "failed",
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }

    // 成功 → successUrl に遷移してフロー完結
    if (context.successUrl) {
      window.location.href = context.successUrl;
    }

    return {
      kind: "completed",
      providerPaymentId: outcome.providerPaymentId,
      rawResult: outcome.rawResult,
    };
  },
};
