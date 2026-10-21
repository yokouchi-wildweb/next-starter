// src/features/core/pairedDevice/hooks/index.ts

// 端末側
export { useSessionDevice } from "./useSessionDevice";
export { useDevicePairingCodeFromUrl } from "./useDevicePairingCodeFromUrl";
export { useClaimDevicePairing, type UseClaimDevicePairingOptions } from "./useClaimDevicePairing";
export {
  useStartDevicePairing,
  type DevicePairingPhase,
  type UseStartDevicePairingOptions,
} from "./useStartDevicePairing";
export { useUnpairThisDevice } from "./useUnpairThisDevice";

// 管理側
export { usePairedDevices } from "./usePairedDevices";
export { usePairedDevice } from "./usePairedDevice";
export { usePairedDeviceKinds } from "./usePairedDeviceKinds";
export { useDevicePairingRequest } from "./useDevicePairingRequest";
export {
  useCreatePairedDevice,
  useUpdatePairedDevice,
  useRevokePairedDevice,
  useIssuePairingCode,
  useCancelDevicePairing,
  useApproveDevicePairing,
} from "./usePairedDeviceMutations";
