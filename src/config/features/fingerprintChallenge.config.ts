// src/config/features/fingerprintChallenge.config.ts
// 回答チャレンジの設定の上書き(持ち主 src/features/core/fingerprintChallenge/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: チャレンジとアクセスログを使う `export default { challenge: { enabled: true, accessLog: { enabled: true } } } satisfies FingerprintChallengeOverride;`
import type { FingerprintChallengeOverride } from "@/features/fingerprintChallenge/config";

export default {} satisfies FingerprintChallengeOverride;
