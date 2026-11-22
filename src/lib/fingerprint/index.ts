// src/lib/fingerprint/index.ts
//
// ブラウザフィンガープリント収集ライブラリの公開エントリーポイント。
// ドメイン非依存（DB / HTTP を持たない）。蓄積・照合は domains/core/deviceFingerprint、
// チャレンジは domains/core/fingerprintChallenge を参照。
//
// collect 系はブラウザ専用 API を使うため client コンポーネント / フックから呼ぶこと
// （SSR 文脈では全成分 null の骨格が返る）。
//
// 入口はこの 1 つ。server のコードも hash 系(stableStringify など)と型をここから読む。
// useBehavioralCapture は "use client" のファイルなので、server の側では client の参照になり
// (呼べない)、他の名前(hash・型・定数)はそのまま使える。

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
