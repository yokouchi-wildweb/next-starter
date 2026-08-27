// src/features/core/deviceFingerprint/entities/model.ts

import type { DeviceFingerprintSource } from "@/features/core/deviceFingerprint/constants";

/**
 * device_fingerprints の 1 レコード。
 */
export type DeviceFingerprint = {
  id: string;
  userId: string;
  source: DeviceFingerprintSource;
  compositeHash: string;
  canvasHash: string | null;
  webglHash: string | null;
  audioHash: string | null;
  fontsHash: string | null;
  screenKey: string | null;
  timezone: string | null;
  languages: string | null;
  platform: string | null;
  hardwareKey: string | null;
  webglRenderer: string | null;
  componentHashes: Record<string, string | null>;
  rawSignals: unknown;
  ip: string | null;
  userAgent: string | null;
  seenCount: number;
  lastSeenAt: Date;
  retentionDays: number;
  createdAt: Date;
};
