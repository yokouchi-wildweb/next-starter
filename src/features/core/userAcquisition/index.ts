// src/features/core/userAcquisition/index.ts
//
// サインアップ流入経路ドメインの公開エントリーポイント (client-safe)。
//
// 書き込み / 取得などの server-only API はこのバレルから export しない
// (client コンポーネントから誤って import された場合に postgres ドライバ等が
//  クライアントバンドルへ流入することを防ぐため)。
//
// server コードからの利用は専用パスを使う:
//   import { recordSignupAcquisition, getUserAcquisition } from "@/features/core/userAcquisition/services/server";
//
// proxy / route から cookie を扱う場合は edge-safe な lib を使う:
//   import { parseAttributionCookie, ... } from "@/features/core/userAcquisition/lib/attributionCookie";

export type {
  AcquisitionExtras,
  AcquisitionTouch,
  UserAcquisition,
  UserAcquisitionTouch,
  AttributionCookieTouch,
  AttributionCookiePayload,
} from "./entities";
export {
  ACQUISITION_COOKIE_NAME,
  ACQUISITION_COOKIE_VERSION,
} from "./constants";
