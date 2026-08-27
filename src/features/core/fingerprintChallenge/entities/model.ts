// src/features/core/fingerprintChallenge/entities/model.ts

import type {
  EffectiveChallengeStatus,
  FingerprintChallengeStatus,
} from "@/features/core/fingerprintChallenge/constants";

/**
 * fingerprint_challenges の 1 レコード。
 * tokenHash は hiddenColumns によりサービス返却時は常に null。
 */
export type FingerprintChallenge = {
  id: string;
  userId: string;
  tokenHash: string | null;
  status: FingerprintChallengeStatus;
  prompt: unknown;
  answers: unknown;
  behavior: unknown;
  fingerprintId: string | null;
  issuedBy: string | null;
  expiresAt: Date;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 回答者本人へ返す公開形 (GET /api/me/fingerprint-challenges/[token])。
 * 管理側の情報 (issuedBy / reviewNote 等) は含めない。
 */
export type FingerprintChallengeForUser = {
  id: string;
  status: EffectiveChallengeStatus;
  prompt: unknown;
  expiresAt: Date;
  submittedAt: Date | null;
  createdAt: Date;
};
