// src/lib/recaptcha/server.ts
//
// 入口 "./server": サーバーでの検証と、版ごとの設定(シークレットを使う時に読む)・デバッグの設定
export { verifyRecaptcha, type RecaptchaVerifyResult } from "./server/verifyRecaptcha";
export { verifyRecaptchaV2, type RecaptchaV2VerifyResult } from "./server/verifyRecaptchaV2";
export { RECAPTCHA_V2_INTERNALS, RECAPTCHA_V3_INTERNALS, type RecaptchaInternals } from "./server/settings";
export { RECAPTCHA_DEBUG } from "./constants";
