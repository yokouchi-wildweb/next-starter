// src/features/core/interactionTracking/services/server/interactionService.ts

import { base } from "./drizzleBase";
import { getAudience, getAudienceSummary } from "./wrappers/getAudience";
import { getCounts, getCountsBulk } from "./wrappers/getCounts";
import { getDailySeries } from "./wrappers/getDailySeries";
import { record } from "./wrappers/record";
import { recordBatch } from "./wrappers/recordBatch";

/**
 * 汎用インタラクション計測サービス（source of truth）。
 *
 * - base: CRUD（serviceRegistry / 汎用 admin ルート用。イベント明細の調査・閲覧向け）
 * - record: イベント追記 + 累計/日次カウンタ原子加算（サーバー内部専用。クライアント
 *   からは公開 ingest ルート POST /api/interactions 経由のみ）
 * - getCounts / getCountsBulk: 累計読み取り（管理一覧の表示用。prune の影響を受けない）
 * - getDailySeries: 日次時系列の読み取り（マーケティング分析用。永久保持）
 * - getAudience / getAudienceSummary: 「誰がクリックしたか」（admin 専用。PII を含む）
 *
 * 消費側（各ドメインの管理一覧 / 将来の userSegment ハンドラ等）は
 * 本サービスをサーバー側で呼び出す。配線レシピは README.md を参照。
 */
export const interactionService = {
  ...base,
  record,
  recordBatch,
  getCounts,
  getCountsBulk,
  getDailySeries,
  getAudience,
  getAudienceSummary,
};
