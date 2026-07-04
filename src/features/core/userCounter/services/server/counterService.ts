// src/features/core/userCounter/services/server/counterService.ts

import { base } from "./drizzleBase";
import { bump } from "./wrappers/bump";
import { bumpDaily } from "./wrappers/bumpDaily";
import { getCounter, getCounters, getCountersByPrefix } from "./wrappers/getCounters";
import { getDailySeries, getTodayCount } from "./wrappers/getDailyCounters";

/**
 * 汎用 per-user カウンタサービス（source of truth）。
 *
 * - base: CRUD（serviceRegistry / 汎用 admin ルート用。get(id) 等は温存）
 * - bump: 累計のみ原子加算（サーバ内部専用。クライアント非公開）
 * - bumpDaily: 累計 + 当日を同一 tx で原子加算（日別推移・日次制限が必要なカウンタ用）
 * - getCounter / getCounters / getCountersByPrefix: 累計の読み取りヘルパ
 * - getTodayCount / getDailySeries: 日次の読み取りヘルパ（日次制限判定・活動グラフ）
 *
 * 消費側（milestone.evaluate / userSegment ハンドラ / 各ドメインの me-route）は
 * 本サービスをサーバ側で呼び出す。詳細・配線レシピは README.md を参照。
 */
export const counterService = {
  ...base,
  bump,
  bumpDaily,
  getCounter,
  getCounters,
  getCountersByPrefix,
  getTodayCount,
  getDailySeries,
};
