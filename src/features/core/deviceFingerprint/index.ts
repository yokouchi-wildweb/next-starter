// src/features/core/deviceFingerprint/index.ts
//
// デバイスフィンガープリントドメインの公開エントリーポイント (client-safe)。
//
// 書き込み / 照合などの server-only API はこのバレルから export しない
// (client コンポーネントから誤って import された場合に postgres ドライバ等が
//  クライアントバンドルへ流入することを防ぐため)。
//
// server コードからの利用は専用パスを使う:
//   import { recordDeviceFingerprint, findUsersBySimilarFingerprint } from "@/features/core/deviceFingerprint/services/server";

export type { DeviceFingerprint, DeviceFingerprintIngestInput } from "./entities";
export {
  DEVICE_FINGERPRINT_SOURCES,
  type DeviceFingerprintSource,
  FINGERPRINT_COMPONENT_KEYS,
  type FingerprintComponentKey,
  FINGERPRINT_COMPONENT_WEIGHTS,
  DEFAULT_SIMILARITY_MIN_SCORE,
  DEFAULT_DEVICE_FINGERPRINT_RETENTION_DAYS,
} from "./constants";
