// src/config/features/fingerprintChallenge.config.ts
// 回答チャレンジの設定の上書き(持ち主 src/features/core/fingerprintChallenge/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: アクセスログを使う `export default { challenge: { accessLog: { enabled: true } } } satisfies FingerprintChallengeOverride;`(チャレンジを使うのは src/config/featureGate/switches.config.ts の deviceFingerprint: true, fingerprintChallenge: true)
import type { FingerprintChallengeOverride } from "@/features/fingerprintChallenge/config";

export default {} satisfies FingerprintChallengeOverride;
