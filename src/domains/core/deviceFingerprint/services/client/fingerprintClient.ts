"use client";

// src/domains/core/deviceFingerprint/services/client/fingerprintClient.ts

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";
import type { FingerprintPayload } from "@/lib/fingerprint";

const ENDPOINT = "/api/me/fingerprint";

/**
 * 収集済みフィンガープリント payload をサーバーへ送信する。
 * 収集の口の機能 deviceFingerprintPageIngest(親 deviceFingerprint)が閉じている環境(既定)では 404 が返る
 * (全ページの送り手 useFingerprintReport は口が閉じていれば送らない。デモ画面は口の機能に依る)。
 */
export async function reportFingerprint(payload: FingerprintPayload): Promise<void> {
  try {
    await axios.post(ENDPOINT, payload);
  } catch (error) {
    throw normalizeHttpError(error, "フィンガープリントの送信に失敗しました");
  }
}
