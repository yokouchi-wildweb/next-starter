"use client";

// src/features/core/fingerprintChallenge/services/client/adminChallengeClient.ts
//
// 管理者向けの ClientService (エンゲージメント計測まわり)。
// 発行 / レビュー / 取り下げは汎用 axios 呼び出しで足りるため未収載 (README の運用例参照)。

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";
import type {
  FingerprintChallenge,
  FingerprintChallengeAccessEvent,
} from "@/features/core/fingerprintChallenge/entities/model";
import type { MarkChallengeNotifiedInput } from "@/features/core/fingerprintChallenge/entities/schema";

const BASE = "/api/admin/fingerprint-challenges";

export type ChallengeAccessEventsPage = {
  results: FingerprintChallengeAccessEvent[];
  total: number;
  page: number;
  limit: number;
};

/** チャレンジ別のアクセスイベント (開いた日時 + IP + UA) を新しい順にページ取得 */
export async function fetchChallengeAccessEvents(
  challengeId: string,
  params: { page?: number; limit?: number } = {},
): Promise<ChallengeAccessEventsPage> {
  try {
    const res = await axios.get<ChallengeAccessEventsPage>(
      `${BASE}/${encodeURIComponent(challengeId)}/access-events`,
      { params },
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "アクセス履歴の取得に失敗しました");
  }
}

/** 本人へ案内を送ったことをスタンプする (notified_at 初回のみ + channels 和集合 + 監査) */
export async function markChallengeNotified(
  challengeId: string,
  input: MarkChallengeNotifiedInput,
): Promise<FingerprintChallenge> {
  try {
    const res = await axios.patch<{ challenge: FingerprintChallenge }>(
      `${BASE}/${encodeURIComponent(challengeId)}`,
      { action: "mark_notified", ...input },
    );
    return res.data.challenge;
  } catch (error) {
    throw normalizeHttpError(error, "通知記録の更新に失敗しました");
  }
}
