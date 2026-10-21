// src/features/core/pairedDevice/services/server/session/index.ts

export {
  getSessionDevice,
  authenticateRequestDevice,
  readDeviceRequestInfo,
} from "./getSessionDevice";
export { deviceGuard, requireCurrentDevice, type SessionDeviceOf } from "./deviceGuard";
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
