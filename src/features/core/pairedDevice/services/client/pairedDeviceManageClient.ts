"use client";

// src/features/core/pairedDevice/services/client/pairedDeviceManageClient.ts
//
// 管理側の API（端末の登録・変更・失効・ペアリング）。管理できる範囲はサーバーが kind の manageableScopes で判定する。

import axios from "axios";

import type {
  DevicePairing,
  DevicePairingRequestForApprover,
  PairedDeviceForAdmin,
} from "@/features/core/pairedDevice/entities/model";
import type {
  ApproveDevicePairingInput,
  CreatePairedDeviceInput,
  ListPairedDevicesInput,
  UpdatePairedDeviceInput,
} from "@/features/core/pairedDevice/entities/schema";
import { normalizeHttpError } from "@/lib/errors";

const BASE = "/api/paired-devices";
const deviceEndpoint = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export type ListPairedDevicesResponse = { results: PairedDeviceForAdmin[]; total: number };

export async function listPairedDevices(
  params: ListPairedDevicesInput = {},
): Promise<ListPairedDevicesResponse> {
  try {
    const res = await axios.get<ListPairedDevicesResponse>(BASE, {
      params: {
        kind: params.kind,
        scope: params.scope ? JSON.stringify(params.scope) : undefined,
        includeRevoked: params.includeRevoked ? "true" : undefined,
        page: params.page,
        limit: params.limit,
      },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "端末の一覧の取得に失敗しました");
  }
}

export type PairedDeviceDetailResponse = {
  device: PairedDeviceForAdmin;
  /** 未使用のペアリングコード（発行中なら 1 件） */
  activePairings: DevicePairing[];
};

export async function fetchPairedDevice(id: string): Promise<PairedDeviceDetailResponse> {
  try {
    const res = await axios.get<PairedDeviceDetailResponse>(deviceEndpoint(id));
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "端末の取得に失敗しました");
  }
}

export async function createPairedDevice(input: CreatePairedDeviceInput): Promise<PairedDeviceForAdmin> {
  try {
    const res = await axios.post<{ device: PairedDeviceForAdmin }>(BASE, input);
    return res.data.device;
  } catch (error) {
    throw normalizeHttpError(error, "端末の登録に失敗しました");
  }
}

export async function updatePairedDevice(
  id: string,
  input: UpdatePairedDeviceInput,
): Promise<PairedDeviceForAdmin> {
  try {
    const res = await axios.patch<{ device: PairedDeviceForAdmin }>(deviceEndpoint(id), input);
    return res.data.device;
  } catch (error) {
    throw normalizeHttpError(error, "端末の変更に失敗しました");
  }
}

export async function revokePairedDevice(
  id: string,
  reason?: string | null,
): Promise<PairedDeviceForAdmin> {
  try {
    const res = await axios.post<{ device: PairedDeviceForAdmin }>(`${deviceEndpoint(id)}/revoke`, {
      reason: reason ?? null,
    });
    return res.data.device;
  } catch (error) {
    throw normalizeHttpError(error, "端末の失効に失敗しました");
  }
}

export type IssuedPairingCodeResponse = {
  pairingId: string;
  /** 端末に入力してもらうコード（表示用に区切った形）。この応答でしか受け取れない */
  code: string;
  expiresAt: string;
};

export async function issuePairingCode(deviceId: string): Promise<IssuedPairingCodeResponse> {
  try {
    const res = await axios.post<IssuedPairingCodeResponse>(`${deviceEndpoint(deviceId)}/pairing-code`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "ペアリングコードの発行に失敗しました");
  }
}

export async function cancelDevicePairing(pairingId: string): Promise<void> {
  try {
    await axios.post(`${BASE}/pairings/${encodeURIComponent(pairingId)}/cancel`);
  } catch (error) {
    throw normalizeHttpError(error, "ペアリングの取り消しに失敗しました");
  }
}

export async function fetchDevicePairingRequest(code: string): Promise<DevicePairingRequestForApprover> {
  try {
    const res = await axios.get<{ request: DevicePairingRequestForApprover }>(`${BASE}/pairing-requests`, {
      params: { code },
    });
    return res.data.request;
  } catch (error) {
    throw normalizeHttpError(error, "ペアリングの情報の取得に失敗しました");
  }
}

export async function approveDevicePairing(
  input: ApproveDevicePairingInput,
): Promise<PairedDeviceForAdmin> {
  try {
    const res = await axios.post<{ device: PairedDeviceForAdmin }>(
      `${BASE}/pairing-requests/approve`,
      input,
    );
    return res.data.device;
  } catch (error) {
    throw normalizeHttpError(error, "ペアリングの承認に失敗しました");
  }
}

export type ManageablePairedDeviceKind = { kind: string; label: string };

export async function listManageablePairedDeviceKinds(): Promise<ManageablePairedDeviceKind[]> {
  try {
    const res = await axios.get<{ kinds: ManageablePairedDeviceKind[] }>(`${BASE}/kinds`);
    return res.data.kinds;
  } catch (error) {
    throw normalizeHttpError(error, "端末の種類の取得に失敗しました");
  }
}
