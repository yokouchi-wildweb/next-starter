// src/domains/core/deviceFingerprint/services/server/index.ts

export { deviceFingerprintBase } from "./deviceFingerprintBase";
export {
  recordDeviceFingerprint,
  type RecordDeviceFingerprintInput,
} from "./recordFingerprint";
export {
  findUsersBySimilarFingerprint,
  compareUsersFingerprints,
  findUsersByExactFingerprint,
  type SimilarFingerprintUserRow,
  type FindUsersBySimilarFingerprintOptions,
  type FingerprintPairComparison,
  type ExactFingerprintUserRow,
  type FindUsersByExactFingerprintOptions,
} from "./similarity";
import { deviceFingerprintBase } from "./deviceFingerprintBase";

/**
 * デバイスフィンガープリント参照系サービス (serviceRegistry 登録用)。
 * 書き込み主経路は recordDeviceFingerprint (upsert) / 照合は similarity を直接使う。
 */
export const deviceFingerprintService = {
  ...deviceFingerprintBase,
};
