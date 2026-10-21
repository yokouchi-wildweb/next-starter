// src/features/core/pairedDevice/services/server/session/index.ts

export {
  getSessionDevice,
  authenticateRequestDevice,
  readDeviceRequestInfo,
  syncPairedDeviceCookie,
} from "./getSessionDevice";
export { deviceGuard, requireCurrentDevice, type SessionDeviceOf } from "./deviceGuard";
export { principalGuard, requireCurrentPrincipal, type SessionPrincipal } from "./principalGuard";
export {
  matchesPrincipalUserRule,
  type PrincipalUserRule,
} from "@/features/core/pairedDevice/utils/principalUserRule";
export {
  PAIRED_DEVICE_COOKIE_NAME,
  PAIRED_DEVICE_PENDING_COOKIE_NAME,
  setPairedDeviceCookie,
  clearPairedDeviceCookie,
  setPendingPairingCookie,
  clearPendingPairingCookie,
  readPairedDeviceToken,
  readPendingPairingToken,
} from "./cookies";
