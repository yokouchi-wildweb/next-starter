// src/lib/firebase/index.ts
// 入口 "."(client と server の両方で読める): 未設定のエラー・Firebase のエラーの判定・鍵の JSON の正規化・設定の型。
// SDK を読み込む物は "./client"(ブラウザの SDK)と "./server"(Admin SDK)。
export {
  FirebaseNotConfiguredError,
  getFirebasePhoneAuthErrorMessage,
  hasFirebaseErrorCode,
} from "./errors";
export { normalizeJsonString } from "./serviceAccountKey";
export type { FirebaseConfig, FirebaseOverride, FirebasePublicConfig, FirebaseServerConfig } from "./config";
