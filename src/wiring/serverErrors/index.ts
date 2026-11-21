// src/wiring/serverErrors/index.ts
// サーバーの失敗の記録を結ぶ: 受け口の一覧(./extensions/reporters.ts、項目は lazy)+ lib/serverErrorReport。読み手は src/instrumentation.ts(と入口の受け止め)
import { createServerErrorReport } from "@/lib/serverErrorReport";

import { reporters } from "./extensions/reporters";

/** 項目の onRequestError 1 回の待ち時間の上限。route handler の応答は Next がこれを待つので短く */
const REPORTER_TIMEOUT_MS = 1500;
/** 項目の register 1 回の待ち時間の上限(起動を止め続けない) */
const REGISTER_TIMEOUT_MS = 10000;

export const serverErrorReport = createServerErrorReport(reporters, {
  // lib は env を読まないので、いまの runtime はここで渡す(未設定 = Node の外の実行 = nodejs 扱い)
  runtime: process.env.NEXT_RUNTIME === "edge" ? "edge" : "nodejs",
  timeoutMs: REPORTER_TIMEOUT_MS,
  registerTimeoutMs: REGISTER_TIMEOUT_MS,
});
