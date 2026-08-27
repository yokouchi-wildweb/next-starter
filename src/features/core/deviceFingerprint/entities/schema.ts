// src/features/core/deviceFingerprint/entities/schema.ts

import { z } from "zod";

import { DEVICE_FINGERPRINT_SOURCES } from "@/features/core/deviceFingerprint/constants";

/** 成分別ハッシュ / 可読キー。lib/fingerprint の FingerprintComponentHashes に対応 */
export const FingerprintComponentHashesSchema = z.object({
  canvas: z.string().max(128).nullable(),
  webgl: z.string().max(128).nullable(),
  audio: z.string().max(128).nullable(),
  fonts: z.string().max(128).nullable(),
  screen: z.string().max(64).nullable(),
  timezone: z.string().max(64).nullable(),
  languages: z.string().max(256).nullable(),
  platform: z.string().max(64).nullable(),
  hardware: z.string().max(64).nullable(),
});

export type FingerprintComponentHashesInput = z.infer<typeof FingerprintComponentHashesSchema>;

/**
 * ingest (クライアント → サーバー) の入力バリデーション。
 * composite_hash はクライアント値を信用せずサーバー側で componentHashes から再計算する。
 */
export const DeviceFingerprintIngestSchema = z.object({
  version: z.number().int().positive(),
  componentHashes: FingerprintComponentHashesSchema,
  webglRenderer: z.string().max(512).nullable().optional(),
  /** 正規化前の生信号。構造はバージョンで変わり得るため unknown で受けサイズ上限のみ課す */
  rawSignals: z.unknown().optional(),
});

export type DeviceFingerprintIngestInput = z.infer<typeof DeviceFingerprintIngestSchema>;

/**
 * CRUD ベース (drizzleBase) の create バリデーション。
 * 主経路は recordDeviceFingerprint (upsert) であり、汎用 create は
 * admin の手動補正くらいにしか使われない想定。
 */
export const DeviceFingerprintCreateSchema = z.object({
  userId: z.string().uuid(),
  source: z.enum(DEVICE_FINGERPRINT_SOURCES),
  compositeHash: z.string().min(1).max(128),
  canvasHash: z.string().max(128).nullable().optional(),
  webglHash: z.string().max(128).nullable().optional(),
  audioHash: z.string().max(128).nullable().optional(),
  fontsHash: z.string().max(128).nullable().optional(),
  screenKey: z.string().max(64).nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
  languages: z.string().max(256).nullable().optional(),
  platform: z.string().max(64).nullable().optional(),
  hardwareKey: z.string().max(64).nullable().optional(),
  webglRenderer: z.string().max(512).nullable().optional(),
  componentHashes: z.record(z.string(), z.string().nullable()),
  rawSignals: z.unknown().optional(),
  ip: z.string().min(1).max(45).nullable().optional(),
  userAgent: z.string().max(1024).nullable().optional(),
  seenCount: z.number().int().positive().optional(),
  lastSeenAt: z.date().optional(),
  retentionDays: z.number().int().positive().max(365 * 50),
});

export type DeviceFingerprintCreateInput = z.infer<typeof DeviceFingerprintCreateSchema>;
