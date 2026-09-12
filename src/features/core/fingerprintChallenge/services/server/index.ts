// src/features/core/fingerprintChallenge/services/server/index.ts

export { fingerprintChallengeBase } from "./drizzleBase";
export {
  issueChallenge,
  getChallengeForUser,
  getPendingChallengeForUser,
  submitChallenge,
  reviewChallenge,
  cancelChallenge,
  markChallengeNotified,
  resolveEffectiveStatus,
  type IssueChallengeResult,
  type SubmitChallengeParams,
  type ReviewChallengeParams,
  type CancelChallengeParams,
  type MarkChallengeNotifiedParams,
} from "./challengeService";
export {
  recordChallengeView,
  listChallengeAccessEvents,
  type RecordChallengeViewInput,
  type ListChallengeAccessEventsParams,
  type ListChallengeAccessEventsResult,
} from "./accessLog";
export {
  pruneExpiredChallengeAccessEvents,
  type PruneOptions,
  type PruneResult,
} from "./pruning";

import { fingerprintChallengeBase } from "./drizzleBase";

/**
 * チャレンジ参照系サービス (serviceRegistry 登録用 = admin の一覧・検索)。
 * 状態遷移は challengeService の各関数を使う (汎用 update での遷移は想定しない)。
 */
export const fingerprintChallengeService = {
  ...fingerprintChallengeBase,
};
