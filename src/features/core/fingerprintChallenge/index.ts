// src/features/core/fingerprintChallenge/index.ts
//
// チャレンジドメインの公開エントリーポイント (client-safe)。
//
// 発行・提出などの server-only API はこのバレルから export しない。
// server コードからの利用は専用パスを使う:
//   import { issueChallenge, submitChallenge } from "@/features/core/fingerprintChallenge/services/server";

export type {
  FingerprintChallenge,
  FingerprintChallengeForUser,
  IssueChallengeInput,
  SubmitChallengeInput,
} from "./entities";
export {
  FINGERPRINT_CHALLENGE_STATUSES,
  type FingerprintChallengeStatus,
  type EffectiveChallengeStatus,
} from "./constants";
