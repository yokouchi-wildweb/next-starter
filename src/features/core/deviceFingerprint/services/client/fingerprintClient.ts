"use client";

// src/features/core/deviceFingerprint/services/client/fingerprintClient.ts

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";
import type { FingerprintPayload } from "@/lib/fingerprint/types";

const ENDPOINT = "/api/me/fingerprint";

/**
 * 収集済みフィンガープリント payload をサーバーへ送信する。
 * FINGERPRINT_CONFIG.collection.enabled が false の環境では 404 が返る
 * (呼び出し側の useFingerprintReport は静かに無視する)。
 */
export async function reportFingerprint(payload: FingerprintPayload): Promise<void> {
  try {
    await axios.post(ENDPOINT, payload);
  } catch (error) {
    throw normalizeHttpError(error, "フィンガープリントの送信に失敗しました");
  }
}
