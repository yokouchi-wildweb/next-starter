// src/features/core/userLoginEvent/services/server/index.ts

export { userLoginEventBase } from "./drizzleBase";
export {
  recordLoginEvent,
  recordLogoutEvent,
  type RecordLoginEventInput,
} from "./recordLoginEvent";
export {
  findSessionHandoffsByUser,
  findSessionHandoffsByIp,
  type SessionHandoffRow,
  type SessionHandoffOptions,
  type SessionStartEventType,
} from "./sessionHandoff";
export {
  countDistinctUsersByIp,
  findUsersBySameIp,
  findUsersBySubnet,
  type SameIpUserRow,
  type SubnetUserRow,
  type FindUsersBySameIpOptions,
  type FindUsersBySubnetOptions,
} from "./ipAnalytics";
export {
  pruneExpiredUserLoginEvents,
  type PruneOptions,
  type PruneResult,
} from "./pruning";

import { userLoginEventBase } from "./drizzleBase";

/**
 * ユーザーログインイベント参照系サービス。
 * 書き込みは recordLoginEvent / recordLogoutEvent、IP 集計は ipAnalytics、
 * 端末受け渡し検出は sessionHandoff を直接使う。
 */
export const userLoginEventService = {
  ...userLoginEventBase,
};
