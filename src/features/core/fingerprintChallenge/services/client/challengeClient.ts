"use client";

// src/features/core/fingerprintChallenge/services/client/challengeClient.ts

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";
import type { BehaviorPayload, FingerprintPayload } from "@/lib/fingerprint/types";
import type { FingerprintChallengeForUser } from "@/features/core/fingerprintChallenge/entities/model";

const BASE = "/api/me/fingerprint-challenges";

const tokenEndpoint = (token: string) => `${BASE}/${encodeURIComponent(token)}`;
const idSubmitEndpoint = (id: string) => `${BASE}/by-id/${encodeURIComponent(id)}/submit`;

/** 回答者本人向けのチャレンジ取得 (質問・状態・期限)。トークン経路 (メールリンク) */
export async function fetchMyChallenge(token: string): Promise<FingerprintChallengeForUser> {
  try {
    const res = await axios.get<{ challenge: FingerprintChallengeForUser }>(tokenEndpoint(token));
    return res.data.challenge;
  } catch (error) {
    throw normalizeHttpError(error, "チャレンジの取得に失敗しました");
  }
}

/**
 * ログイン本人の未回答チャレンジ (最新・期限内) を取得する。無ければ null。
 * トークンを持たない本人向け経路 (着地ページ CTA 等)
 */
export async function fetchMyPendingChallenge(): Promise<FingerprintChallengeForUser | null> {
  try {
    const res = await axios.get<{ challenge: FingerprintChallengeForUser | null }>(
      `${BASE}/pending`,
    );
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

/**
 * 提出先の指定。トークン経路 ({ token }) か本人スコープ経路 ({ id }) のどちらか。
 * id は fetchMyPendingChallenge / fetchMyChallenge の戻り値の id。
 */
export type SubmitMyChallengeTarget = { token: string; id?: never } | { id: string; token?: never };

/** 回答を提出する (フィンガープリント + 行動計測 payload を添付) */
export async function submitMyChallenge(
  target: SubmitMyChallengeTarget,
  body: SubmitMyChallengeBody,
): Promise<FingerprintChallengeForUser> {
  const url =
    target.token !== undefined
      ? `${tokenEndpoint(target.token)}/submit`
      : idSubmitEndpoint(target.id);
  try {
    const res = await axios.post<{ challenge: FingerprintChallengeForUser }>(url, body);
    return res.data.challenge;
  } catch (error) {
    throw normalizeHttpError(error, "回答の送信に失敗しました");
  }
}
