// src/features/core/userCounter/services/server/counterService.ts

import { base } from "./drizzleBase";
import { bump } from "./wrappers/bump";
import { getCounter, getCounters, getCountersByPrefix } from "./wrappers/getCounters";

/**
 * 汎用 per-user カウンタサービス（source of truth）。
 *
 * - base: CRUD（serviceRegistry / 汎用 admin ルート用。get(id) 等は温存）
 * - bump: 原子加算（サーバ内部専用。クライアント非公開）
 * - getCounter / getCounters / getCountersByPrefix: 読み取りヘルパ
 *
 * 消費側（milestone.evaluate / userSegment ハンドラ / 各ドメインの me-route）は
 * 本サービスをサーバ側で呼び出す。詳細・配線レシピは README.md を参照。
 */
export const counterService = {
  ...base,
  bump,
  getCounter,
  getCounters,
  getCountersByPrefix,
};
