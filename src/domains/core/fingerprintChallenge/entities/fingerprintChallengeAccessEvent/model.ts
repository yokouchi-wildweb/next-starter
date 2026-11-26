// src/domains/core/fingerprintChallenge/entities/fingerprintChallengeAccessEvent/model.ts

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
