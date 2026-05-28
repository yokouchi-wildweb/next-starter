// src/features/core/userLoginEvent/services/server/index.ts

export { userLoginEventBase } from "./drizzleBase";
export { recordLoginEvent, type RecordLoginEventInput } from "./recordLoginEvent";
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
 * 書き込みは recordLoginEvent / IP 集計は ipAnalytics を直接使う。
 */
export const userLoginEventService = {
  ...userLoginEventBase,
};
