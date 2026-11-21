// src/lib/recaptcha/siteKey.ts
//
// サイトキー(公開の値)の読み取り。client でも server でも読める(シークレットは ./server の settings.ts)

import { recaptchaConfig } from "./config";
import { RECAPTCHA_MIN_KEY_LENGTH } from "./constants";

export type RecaptchaVersion = "v3" | "v2";

/** その版のサイトキー(空 = 未設定) */
export function recaptchaSiteKey(version: RecaptchaVersion): string {
  return recaptchaConfig[version].siteKey;
}

/** その版のサイトキーが有効か(空や短すぎる値は無効) */
export function hasRecaptchaSiteKey(version: RecaptchaVersion): boolean {
  return recaptchaSiteKey(version).length >= RECAPTCHA_MIN_KEY_LENGTH;
}
