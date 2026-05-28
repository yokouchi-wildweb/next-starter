// src/features/core/userLoginEvent/index.ts
//
// ユーザーログインイベントドメインの公開エントリーポイント (client-safe)。
//
// 書き込み / 集計などの server-only API はこのバレルから export しない
// (client コンポーネントから誤って import された場合に postgres ドライバ等が
//  クライアントバンドルへ流入することを防ぐため)。
//
// server コードからの利用は専用パスを使う:
//   import { recordLoginEvent, countDistinctUsersByIp } from "@/features/core/userLoginEvent/services/server";

export type { UserLoginEvent, UserLoginEventCreateInput } from "./entities";
export {
  USER_LOGIN_EVENT_TYPES,
  type UserLoginEventType,
  DEFAULT_LOGIN_EVENT_RETENTION_DAYS,
} from "./constants";
