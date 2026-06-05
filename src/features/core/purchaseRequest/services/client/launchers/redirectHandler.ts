// src/features/core/purchaseRequest/services/client/launchers/redirectHandler.ts
//
// "redirect" 型の LaunchInstruction を処理するハンドラ。
// 既存の window.location.href 代入の挙動をそのまま踏襲する。

"use client";

import type { LaunchRedirect } from "@/features/core/purchaseRequest/types/payment";
import type { LaunchContext, LaunchHandler, LaunchResult } from "./types";

export const redirectHandler: LaunchHandler<LaunchRedirect> = {
  async execute(instruction: LaunchRedirect, _context: LaunchContext): Promise<LaunchResult> {
    // ブラウザ遷移を即時開始。url が空ならば失敗扱い。
    if (!instruction.url) {
      return {
        kind: "failed",
        error: new Error("LaunchRedirect.url が空です"),
      };
    }
    window.location.href = instruction.url;
    // ページ遷移が走るため、ここから後の呼び元コードは事実上実行されない。
    // ただし型上は Promise を返す必要があるので "redirected" を返却。
    return { kind: "redirected" };
  },
};
