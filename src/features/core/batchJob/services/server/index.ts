// src/features/core/batchJob/services/server/index.ts
// ハンドラ登録を保証した上でサービスを公開する。
// APIルート等のエントリポイントはここからインポートすること。

import "./registerHandlers";

export { batchJobService } from "./batchJobService";
export { registerBatchJobHandler, getHandler } from "./registry";
export { createJobFromQuery } from "./helpers";
