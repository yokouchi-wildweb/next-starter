// src/lib/recaptcha/server/settings.ts
//
// reCAPTCHA の版ごとの設定(サーバー専用)。シークレットは使う時に上書きの関数を呼んで読む(読み込み時には読まない)。
// サイトキーと検証の URL も同じ形で持つ(検証の関数・routeFactory・API route が読む)

import { recaptchaConfig, type RecaptchaKeys } from "../config";
import { RECAPTCHA_MIN_KEY_LENGTH, RECAPTCHA_VERIFY_URL } from "../constants";

/** 1 つの版の設定(サイトキー・シークレット・検証の URL と、有効かの判定) */
export type RecaptchaInternals = {
  readonly siteKey: string;
  readonly secretKey: string;
  readonly verifyUrl: string;
  readonly hasSiteKey: boolean;
  readonly hasSecretKey: boolean;
  /** 両方のキーが有効な場合だけ有効 */
  readonly enabled: boolean;
};

/** 版のキーを返す関数から設定を作る(キーは使うたびに読む) */
export const createRecaptchaInternals = (keys: () => RecaptchaKeys): RecaptchaInternals => ({
  get siteKey() {
    return keys().siteKey;
  },
  get secretKey() {
    return keys().secretKey() ?? "";
  },
  verifyUrl: RECAPTCHA_VERIFY_URL,
  get hasSiteKey() {
    return this.siteKey.length >= RECAPTCHA_MIN_KEY_LENGTH;
  },
  get hasSecretKey() {
    return this.secretKey.length >= RECAPTCHA_MIN_KEY_LENGTH;
  },
  get enabled() {
    return this.hasSiteKey && this.hasSecretKey;
  },
});

/** reCAPTCHA v3 の設定 */
export const RECAPTCHA_V3_INTERNALS: RecaptchaInternals = createRecaptchaInternals(() => recaptchaConfig.v3);

/** reCAPTCHA v2 の設定 */
export const RECAPTCHA_V2_INTERNALS: RecaptchaInternals = createRecaptchaInternals(() => recaptchaConfig.v2);
