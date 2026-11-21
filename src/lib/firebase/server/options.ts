// src/lib/firebase/server/options.ts
// 設定から Admin の値を作る純粋な関数。firebase-admin を初期化しない(テストが直に読む)。
// 鍵の関数(serviceAccountKey)を呼ぶのはここだけ(./server の中)。呼んだ時に読む = 読み込み時には読まない

import type { AppOptions } from "firebase-admin/app";

import type { FirebaseConfig } from "../config";

/** 鍵を呼んだ時点で読む。空・undefined は "" */
export function readServiceAccountKey(config: FirebaseConfig): string {
  return (config.serviceAccountKey() ?? "").trim();
}

/** 公開の設定から Admin アプリの projectId / storageBucket を作る(空の値は渡さない) */
export function firebaseAdminOptions(config: FirebaseConfig): Pick<AppOptions, "projectId" | "storageBucket"> {
  const options: Pick<AppOptions, "projectId" | "storageBucket"> = {};
  if (config.projectId) options.projectId = config.projectId;
  if (config.storageBucket) options.storageBucket = config.storageBucket;
  return options;
}
