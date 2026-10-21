// src/features/core/pairedDevice/services/server/index.ts
//
// 登録端末の server-only API。HTTP からの入口は routeFactory（createDeviceRoute）と
// /api/paired-device/**（端末側）・/api/admin/paired-devices/**（管理側）。

export { pairedDeviceBase } from "./drizzleBase";
export {
  PairedDeviceError,
  isPairedDeviceError,
  assertPairedDeviceEnabled,
  getPairedDeviceKind,
  listPairedDeviceKinds,
  parseDeviceScope,
  safeParseDeviceScope,
  resolveManageableScopes,
  canManagePairedDevice,
  assertCanManagePairedDevice,
  buildManageableDevicesWhere,
} from "./kinds";
export {
  authenticateDeviceToken,
  issueDeviceToken,
  resolveTokenMaxAgeDays,
  resolveIdleRevokeDays,
  type AuthenticatedDevice,
  type DeviceRequestInfo,
  type IssuedDeviceToken,
} from "./deviceToken";
export {
  createPairedDevice,
  updatePairedDevice,
  revokePairedDevice,
  getManagedPairedDevice,
  listPairedDevices,
  resolvePairedDeviceState,
  toPairedDeviceForAdmin,
  type PairedDeviceActor,
  type ListPairedDevicesResult,
} from "./deviceService";
export {
  issuePairingCode,
  claimPairingCode,
  startDevicePairing,
  getDevicePairingRequest,
  approveDevicePairing,
  pollDevicePairing,
  cancelDevicePairing,
  listActivePairingsForDevice,
  pruneExpiredDevicePairings,
  resolvePairingStatus,
  type IssuedPairingCode,
  type CompletedPairing,
  type StartedDevicePairing,
  type DevicePairingPollResult,
} from "./pairingService";
export { pairedDeviceErrorResponse, withPairedDeviceErrors } from "./http";
