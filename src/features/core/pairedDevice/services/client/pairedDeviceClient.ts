"use client";

// src/features/core/pairedDevice/services/client/pairedDeviceClient.ts
//
// 端末側の API（この端末の状態・ペアリング）。端末トークンは httpOnly Cookie で、JS からは扱わない。

import axios from "axios";

import type { SessionDevice } from "@/features/core/pairedDevice/entities/model";
import { normalizeHttpError } from "@/lib/errors";

const BASE = "/api/paired-device";

/** この端末が登録済みなら端末の情報、未登録なら null */
export async function fetchSessionDevice(): Promise<SessionDevice | null> {
  try {
    const res = await axios.get<{ device: SessionDevice | null }>(`${BASE}/session`);
    return res.data.device;
  } catch (error) {
    throw normalizeHttpError(error, "端末の状態の取得に失敗しました");
  }
}

/** この端末の登録を解除する（Cookie も消える） */
export async function unpairThisDevice(): Promise<void> {
  try {
    await axios.delete(`${BASE}/session`);
  } catch (error) {
    throw normalizeHttpError(error, "端末の登録解除に失敗しました");
  }
}

/** 管理者から受け取ったコードを送り、この端末を登録する */
export async function claimPairingCode(code: string): Promise<SessionDevice> {
  try {
    const res = await axios.post<{ device: SessionDevice }>(`${BASE}/pairing/claim`, { code });
    return res.data.device;
  } catch (error) {
    throw normalizeHttpError(error, "端末の登録に失敗しました");
  }
}

export type StartedDevicePairingResponse = {
  /** 画面に表示するコード（QR には承認ページの URL と一緒に入れる） */
  code: string;
  expiresAt: string;
  /** 承認を確認しに行く間隔の目安（秒） */
  pollIntervalSeconds: number;
};

/** この端末からペアリングを始める（管理者の承認待ちのコードを受け取る） */
export async function startDevicePairing(): Promise<StartedDevicePairingResponse> {
  try {
    const res = await axios.post<StartedDevicePairingResponse>(`${BASE}/pairing/start`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "ペアリングを開始できませんでした");
  }
}

export type DevicePairingStatusResponse =
  | { status: "pending" | "expired" | "canceled"; expiresAt: string }
  | { status: "completed"; device: SessionDevice };

/** この端末から始めたペアリングが承認されたかを確認する（承認済みならこの端末が登録される） */
export async function pollDevicePairing(): Promise<DevicePairingStatusResponse> {
  try {
    const res = await axios.post<DevicePairingStatusResponse>(`${BASE}/pairing/status`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "ペアリングの状態の確認に失敗しました");
  }
}
