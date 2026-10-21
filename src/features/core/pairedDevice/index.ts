// src/features/core/pairedDevice/index.ts
//
// 登録端末ドメインの公開エントリーポイント (client-safe)。
// server-only API はこのバレルから export しない:
//   import { getSessionDevice } from "@/features/core/pairedDevice/services/server/session";
//   import { issuePairingCode } from "@/features/core/pairedDevice/services/server";

export type {
  PairedDevice,
  PairedDeviceForAdmin,
  PairedDeviceForAdminDto,
  PairedDeviceState,
  SessionDevice,
  DevicePairing,
  DevicePairingRequestForApprover,
  DevicePairingRequestForApproverDto,
  DevicePairingDto,
  Jsonified,
  EffectiveDevicePairingStatus,
  CreatePairedDeviceInput,
  UpdatePairedDeviceInput,
  ListPairedDevicesInput,
  ClaimPairingCodeInput,
  ApproveDevicePairingInput,
} from "./entities";
export {
  DEVICE_PAIRING_FLOWS,
  DEVICE_PAIRING_STATUSES,
  PAIRED_DEVICE_ERROR_REASONS,
  type DevicePairingFlow,
  type DevicePairingStatus,
  type PairedDeviceErrorReason,
} from "./constants";
export {
  definePairedDeviceKind,
  type PairedDeviceKindDefinition,
  type PairedDeviceManageableScopes,
  type PairedDeviceVerifyContext,
} from "./types/kind";
export { getPairedDeviceErrorReason } from "./utils/errorReason";
