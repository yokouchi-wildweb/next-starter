// src/features/core/fingerprintChallenge/services/server/index.ts

export { fingerprintChallengeBase } from "./drizzleBase";
export {
  issueChallenge,
  getChallengeForUser,
  submitChallenge,
  reviewChallenge,
  cancelChallenge,
  resolveEffectiveStatus,
  type IssueChallengeResult,
  type SubmitChallengeParams,
  type ReviewChallengeParams,
  type CancelChallengeParams,
} from "./challengeService";

import { fingerprintChallengeBase } from "./drizzleBase";

/**
 * チャレンジ参照系サービス (serviceRegistry 登録用 = admin の一覧・検索)。
 * 状態遷移は challengeService の各関数を使う (汎用 update での遷移は想定しない)。
 */
export const fingerprintChallengeService = {
  ...fingerprintChallengeBase,
};
