// src/lib/recaptcha/index.ts
//
// 入口 ".": client の部品・フックとトークンの取得、アクション名、サイトキー(公開)、設定の型(client でも server でも読める)。
// 検証と版ごとの設定(シークレット)は入口 "./server"(server.ts)

export { getRecaptchaToken } from "./client/executeRecaptcha";
export { RecaptchaBadge } from "./components/RecaptchaBadge";
export { RecaptchaProvider } from "./components/RecaptchaProvider";
export { RecaptchaV2Challenge } from "./components/RecaptchaV2Challenge";
export { useRecaptcha } from "./hooks/useRecaptcha";
export {
  useRecaptchaV2Challenge,
  isV2ChallengeRequired,
} from "./hooks/useRecaptchaV2Challenge";

export { RECAPTCHA_ACTIONS, type RecaptchaAction } from "./constants";
export { hasRecaptchaSiteKey, recaptchaSiteKey, type RecaptchaVersion } from "./siteKey";
export type { RecaptchaConfig, RecaptchaKeys, RecaptchaOverride } from "./config";
