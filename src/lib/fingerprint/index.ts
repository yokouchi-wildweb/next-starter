// src/lib/fingerprint/index.ts
//
// ブラウザフィンガープリント収集ライブラリの公開エントリーポイント。
// ドメイン非依存（DB / HTTP を持たない）。蓄積・照合は features/core/deviceFingerprint、
// チャレンジは features/core/fingerprintChallenge を参照。
//
// collect 系はブラウザ専用 API を使うため client コンポーネント / フックから呼ぶこと
// （SSR 文脈では全成分 null の骨格が返る）。
//
// NOTE: このバレルは "use client" モジュール (useBehavioralCapture) を含むため、
// server コードからは import しないこと（client モジュールの値 export は RSC で
// undefined になる）。server で hash 系が必要な場合は "@/lib/fingerprint/hash" を、
// 型のみ必要な場合は "@/lib/fingerprint/types" を直接 import する。

export {
  collectDeviceSignals,
  buildComponentHashes,
  collectFingerprintPayload,
} from "./collect";
export { hashString, hashValue, stableStringify, fnv1a32Hex } from "./hash";
export { useBehavioralCapture, type BehavioralCapture } from "./useBehavioralCapture";
export {
  FINGERPRINT_SIGNALS_VERSION,
  BEHAVIOR_PAYLOAD_VERSION,
  type DeviceSignals,
  type FingerprintComponentHashes,
  type FingerprintPayload,
  type BehaviorPayload,
  type FieldBehavior,
  type PointerBehavior,
} from "./types";
