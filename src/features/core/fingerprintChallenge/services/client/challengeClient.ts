"use client";

// src/features/core/fingerprintChallenge/services/client/challengeClient.ts

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";
import type { BehaviorPayload, FingerprintPayload } from "@/lib/fingerprint/types";
import type { FingerprintChallengeForUser } from "@/features/core/fingerprintChallenge/entities/model";

const endpoint = (token: string) =>
  `/api/me/fingerprint-challenges/${encodeURIComponent(token)}`;

/** 回答者本人向けのチャレンジ取得 (質問・状態・期限) */
export async function fetchMyChallenge(token: string): Promise<FingerprintChallengeForUser> {
  try {
    const res = await axios.get<{ challenge: FingerprintChallengeForUser }>(endpoint(token));
    return res.data.challenge;
  } catch (error) {
    throw normalizeHttpError(error, "チャレンジの取得に失敗しました");
  }
}

export type SubmitMyChallengeBody = {
  answers: unknown;
  fingerprint: FingerprintPayload;
  behavior?: BehaviorPayload;
};

/** 回答を提出する (フィンガープリント + 行動計測 payload を添付) */
export async function submitMyChallenge(
  token: string,
  body: SubmitMyChallengeBody,
): Promise<FingerprintChallengeForUser> {
  try {
    const res = await axios.post<{ challenge: FingerprintChallengeForUser }>(
      `${endpoint(token)}/submit`,
      body,
    );
    return res.data.challenge;
  } catch (error) {
    throw normalizeHttpError(error, "回答の送信に失敗しました");
  }
}
