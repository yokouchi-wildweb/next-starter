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
  /** 管理者が案内を送った時刻 (初回)。markChallengeNotified で設定 */
  notifiedAt: Date | null;
  /** 案内チャネルの和集合 (語彙は downstream 自由) */
  notifiedChannels: string[];
  /** 本人が初めて開いた時刻 (accessLog 有効時のみ) */
  firstViewedAt: Date | null;
  /** 本人が最後に開いた時刻 (accessLog 有効時のみ) */
  lastViewedAt: Date | null;
  /** 閲覧回数 (dedupe 済み。accessLog 有効時のみ増える) */
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * fingerprint_challenge_access_events の 1 レコード (admin 専用。IP を含む PII)。
 * GET /api/admin/fingerprint-challenges/[id]/access-events で返す。
 */
export type FingerprintChallengeAccessEvent = {
  id: string;
  challengeId: string;
  userId: string;
  ip: string | null;
  userAgent: string | null;
  accessedAt: Date;
  retentionDays: number;
};

/**
 * 回答者本人へ返す公開形 (GET /api/me/fingerprint-challenges/[token] | /pending)。
 * 管理側の情報 (issuedBy / reviewNote / 閲覧カウンタ / 通知記録 等) は含めない。
 * 閲覧計測の存在自体を本人に見せないため、viewed 系列は意図的に持たない。
 */
export type FingerprintChallengeForUser = {
  id: string;
  status: EffectiveChallengeStatus;
  prompt: unknown;
  expiresAt: Date;
  submittedAt: Date | null;
  createdAt: Date;
};
