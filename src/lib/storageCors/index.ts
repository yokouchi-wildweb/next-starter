// src/lib/storageCors/index.ts
//
// 別ドメインの Storage バイトをブラウザで読む機能の「CORS 未設定」自己診断ユーティリティ。
// 詳細・設計方針は ./diagnostics.ts と ./README.md を参照。

export {
  STORAGE_CORS_DOC_PATH,
  STORAGE_CORS_SETUP_COMMAND,
  isCorsLikeFetchError,
  isLikelyCrossOriginStorageUrl,
  isTaintedCanvasError,
  diagnoseStorageFetchError,
  diagnoseTaintedCanvasError,
  fetchStorageBytes,
  canvasToBlobSafe,
} from "./diagnostics";
