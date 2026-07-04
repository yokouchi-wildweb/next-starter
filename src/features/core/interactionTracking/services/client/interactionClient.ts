// src/features/core/interactionTracking/services/client/interactionClient.ts

"use client";

import axios from "axios";

import type { InteractionIngestInput } from "@/features/core/interactionTracking/entities/schema";

const ENDPOINT = "/api/interactions";

/**
 * インタラクションを記録する（fire-and-forget）。
 *
 * - await しない前提。UI 遷移・クリックハンドラをブロックしない
 * - 計測は本体機能ではないため、失敗（レート制限・オフライン等）は握りつぶす。
 *   エラーをハンドリングしたい特殊ケースは無い想定（計測失敗をユーザーに見せない）
 * - ログインユーザーの userId はサーバー側でセッションから自動付与される
 *   （クライアントから userId を送る経路は存在しない）
 */
export function trackInteraction(input: InteractionIngestInput): void {
  void axios.post(ENDPOINT, input).catch(() => {
    // 計測の失敗は UI に影響させない（意図的に無視）
  });
}
