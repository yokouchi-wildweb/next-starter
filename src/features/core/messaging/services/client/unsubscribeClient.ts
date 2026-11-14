"use client";

// src/features/core/messaging/services/client/unsubscribeClient.ts
//
// 確認のページ /unsubscribe の「配信を停止する」: One-Click の受け口 /api/messaging/unsubscribe?token= へ POST(ログイン不要、トークンが権限)

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const PATH = "/api/messaging/unsubscribe";

/** 配信を止める(何度送っても同じ結果)。トークンが正しくなければ 400 */
export async function postUnsubscribe(token: string): Promise<void> {
  try {
    await axios.post(PATH, null, { params: { token } });
  } catch (error) {
    throw normalizeHttpError(error, "配信を停止できませんでした");
  }
}
