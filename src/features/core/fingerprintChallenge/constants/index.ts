// src/features/core/fingerprintChallenge/constants/index.ts

/**
 * fingerprint_challenges.status で許容する値。
 *
 * - pending: 発行済み・未回答
 * - submitted: ユーザーが回答提出済み (フィンガープリント + 行動計測が添付される)
 * - reviewed: 管理者が確認済み
 * - canceled: 管理者が取り下げ
 *
 * 「期限切れ」は状態として持たず、pending かつ expires_at < now を
 * 読み取り時に導出する (resolveEffectiveStatus)。cron による状態遷移は不要。
 */
export const FINGERPRINT_CHALLENGE_STATUSES = [
  "pending",
  "submitted",
  "reviewed",
  "canceled",
] as const;
export type FingerprintChallengeStatus = (typeof FINGERPRINT_CHALLENGE_STATUSES)[number];

/** 読み取り時に導出される実効ステータス (expired は DB に書かれない) */
export type EffectiveChallengeStatus = FingerprintChallengeStatus | "expired";
