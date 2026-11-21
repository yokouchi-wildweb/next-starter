// src/lib/firebase/client.ts
// 入口 "./client": ブラウザの Firebase SDK(読み込むと app を初期化する)。app・auth・fstore・Analytics・Auth のアクションコード・メールリンク。
export { app, auth, fstore, isFirebaseClientConfigured } from "./client/app";
export { getFirebaseAnalytics, trackEvent, trackPageView } from "./client/analytics";
export { applyEmailChange, getEmailChangeInfo } from "./client/applyEmailChange";
export type { EmailChangeInfo } from "./client/applyEmailChange";
export { checkActionCodeValidity } from "./client/checkActionCodeValidity";
export { signInWithEmailLinkClient } from "./client/signInWithEmailLinkClient";
