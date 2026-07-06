// src/features/core/userAcquisition/entities/model.ts

/**
 * 集計軸にしないロングテール情報のキーバリュー。
 * 例: utm_term / utm_content / gclid / fbclid / gaClientId
 */
export type AcquisitionExtras = Record<string, string>;

/**
 * 1 回の流入タッチ（ドメイン内部の正規化表現）。
 * cookie 上の圧縮表現（AttributionCookieTouch）から復元したもの。
 */
export type AcquisitionTouch = {
  occurredAt: Date;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
  landingPage: string | null;
  extras: AcquisitionExtras | null;
};

/** user_acquisitions（1:1 サマリー）の 1 レコード */
export type UserAcquisition = {
  id: string;
  userId: string;
  firstUtmSource: string | null;
  firstUtmMedium: string | null;
  firstUtmCampaign: string | null;
  firstReferrerHost: string | null;
  firstLandingPage: string | null;
  firstTouchAt: Date;
  lastUtmSource: string | null;
  lastUtmMedium: string | null;
  lastUtmCampaign: string | null;
  lastReferrerHost: string | null;
  lastLandingPage: string | null;
  lastTouchAt: Date;
  touchCount: number;
  signupAt: Date;
  extras: AcquisitionExtras | null;
  createdAt: Date;
  updatedAt: Date;
};

/** user_acquisition_touches（1:N 明細）の 1 レコード */
export type UserAcquisitionTouch = {
  id: string;
  userId: string;
  touchIndex: number;
  occurredAt: Date;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
  landingPage: string | null;
  extras: AcquisitionExtras | null;
  createdAt: Date;
};
