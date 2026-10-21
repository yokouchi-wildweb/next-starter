"use client";

// src/features/core/pairedDevice/hooks/usePairedDeviceMutations.ts
//
// 管理側の mutation フック。成功すると一覧・詳細（pairedDevices/*）を再検証する。
// 失敗の理由は getPairedDeviceErrorReason(error) で取り出せる。

import type { PairedDeviceForAdmin } from "@/features/core/pairedDevice/entities/model";
import type {
  ApproveDevicePairingInput,
  CreatePairedDeviceInput,
  UpdatePairedDeviceInput,
} from "@/features/core/pairedDevice/entities/schema";
import {
  approveDevicePairing,
  cancelDevicePairing,
  createPairedDevice,
  issuePairingCode,
  revokePairedDevice,
  updatePairedDevice,
  type IssuedPairingCodeResponse,
} from "@/features/core/pairedDevice/services/client/pairedDeviceManageClient";
import { useDomainMutation } from "@/lib/crud/hooks";

import { PAIRED_DEVICES_KEY } from "./keys";

/** 端末を登録する（未ペアリングの状態で作られる。続けて useIssuePairingCode でコードを出す） */
export function useCreatePairedDevice() {
  return useDomainMutation<PairedDeviceForAdmin, CreatePairedDeviceInput>(
    "pairedDevices/create",
    (input) => createPairedDevice(input),
    PAIRED_DEVICES_KEY,
  );
}

/** 名前の変更・scope の付け替え（再ペアリング不要） */
export function useUpdatePairedDevice() {
  return useDomainMutation<PairedDeviceForAdmin, { id: string; input: UpdatePairedDeviceInput }>(
    "pairedDevices/update",
    ({ id, input }) => updatePairedDevice(id, input),
    PAIRED_DEVICES_KEY,
  );
}

/** 端末を失効させる（次のリクエストから使えなくなる。再ペアリングで戻せる） */
export function useRevokePairedDevice() {
  return useDomainMutation<PairedDeviceForAdmin, { id: string; reason?: string | null }>(
    "pairedDevices/revoke",
    ({ id, reason }) => revokePairedDevice(id, reason),
    PAIRED_DEVICES_KEY,
  );
}

/**
 * ペアリングコードを発行する。data.code を端末で入力してもらう（この応答でしか受け取れない）。
 * 失効済みの端末に発行すると再ペアリングになる。
 */
export function useIssuePairingCode() {
  return useDomainMutation<IssuedPairingCodeResponse, string>(
    "pairedDevices/issuePairingCode",
    (deviceId) => issuePairingCode(deviceId),
    PAIRED_DEVICES_KEY,
  );
}

/** 未使用のペアリングコードを取り消す */
export function useCancelDevicePairing() {
  return useDomainMutation<void, string>(
    "pairedDevices/cancelPairing",
    (pairingId) => cancelDevicePairing(pairingId),
    PAIRED_DEVICES_KEY,
  );
}

/**
 * 端末から始めたペアリングを承認する。既存の端末を割り当てる（{ code, deviceId }）か、
 * その場で登録する（{ code, device: { label, kind, scope } }）。
 */
export function useApproveDevicePairing() {
  return useDomainMutation<PairedDeviceForAdmin, ApproveDevicePairingInput>(
    "pairedDevices/approvePairing",
    (input) => approveDevicePairing(input),
    PAIRED_DEVICES_KEY,
  );
}
