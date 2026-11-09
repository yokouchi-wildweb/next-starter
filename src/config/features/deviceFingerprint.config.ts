// src/config/features/deviceFingerprint.config.ts
// フィンガープリントの収集の設定の上書き(持ち主 src/features/core/deviceFingerprint/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: 全ページ収集を始める `export default { collection: { enabled: true } } satisfies DeviceFingerprintOverride;`
import type { DeviceFingerprintOverride } from "@/features/deviceFingerprint/config";

export default {} satisfies DeviceFingerprintOverride;
