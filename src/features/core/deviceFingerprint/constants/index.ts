// src/features/core/deviceFingerprint/constants/index.ts

/**
 * device_fingerprints.source で許容する値。
 *
 * - page: 全ページ設置型の収集（useFingerprintReport → POST /api/me/fingerprint）
 * - challenge: 不正疑いユーザーへの回答チャレンジ提出時の強制収集
 *   （fingerprintChallenge ドメインの submit 経路）
 */
export const DEVICE_FINGERPRINT_SOURCES = ["page", "challenge"] as const;
export type DeviceFingerprintSource = (typeof DEVICE_FINGERPRINT_SOURCES)[number];

/**
 * 類似照合の対象となる成分キー。
 * lib/fingerprint の FingerprintComponentHashes のキー集合と一致させること
 * （変更時は entities/drizzle.ts のカラムと similarity.ts の SQL も同時更新）。
 */
export const FINGERPRINT_COMPONENT_KEYS = [
  "canvas",
  "webgl",
  "audio",
  "fonts",
  "screen",
  "timezone",
  "languages",
  "platform",
  "hardware",
] as const;
export type FingerprintComponentKey = (typeof FINGERPRINT_COMPONENT_KEYS)[number];

/**
 * 類似スコアの成分別重み。
 * Canvas / Audio はデバイス個体差が強く出る（= 一致の証拠力が高い）ため重く、
 * screen / timezone / languages / platform は同一環境が大量に存在するため軽い。
 * 合計満点は 15。
 */
export const FINGERPRINT_COMPONENT_WEIGHTS: Record<FingerprintComponentKey, number> = {
  canvas: 3,
  audio: 3,
  webgl: 2,
  fonts: 2,
  screen: 1,
  timezone: 1,
  languages: 1,
  platform: 1,
  hardware: 1,
};

/** findUsersBySimilarFingerprint の既定最小スコア（強成分 1 つ + 弱成分 2 つ相当） */
export const DEFAULT_SIMILARITY_MIN_SCORE = 5;

/** 既定の保持期間（日）。userLoginEvent と同じ行単位 retention + 日次 cron prune */
export const DEFAULT_DEVICE_FINGERPRINT_RETENTION_DAYS = 365;
