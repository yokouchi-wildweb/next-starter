// src/domains/core/userLoginEvent/services/server/index.ts

export { userLoginEventBase } from "./userLoginEventBase";
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
import { userLoginEventBase } from "./userLoginEventBase";

/**
 * ユーザーログインイベント参照系サービス。
 * 書き込みは recordLoginEvent / recordLogoutEvent、IP 集計は ipAnalytics、
 * 端末受け渡し検出は sessionHandoff を直接使う。
 */
export const userLoginEventService = {
  ...userLoginEventBase,
};
