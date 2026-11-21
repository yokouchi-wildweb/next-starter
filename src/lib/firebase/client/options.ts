// src/lib/firebase/client/options.ts
// 公開の設定(FirebasePublicConfig)から client の SDK に渡す形を作る純粋な関数。SDK を初期化しない(テストが直に読む)

import type { FirebaseOptions } from "firebase/app";

import type { FirebasePublicConfig } from "../config";

/** 公開の設定から SDK の initializeApp に渡す形を作る(測定 ID が空なら渡さない) */
export function firebaseClientOptions(config: FirebasePublicConfig): FirebaseOptions {
  return {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    measurementId: config.measurementId || undefined,
  };
}

/** 公開の設定が揃っている(API key と projectId が非空)か = client の「設定済み」 */
export function isClientConfigComplete(config: FirebasePublicConfig): boolean {
  return config.apiKey.trim().length > 0 && config.projectId.trim().length > 0;
}
