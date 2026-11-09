// src/config/features/deviceFingerprint.config.ts
// フィンガープリントの収集の設定の上書き(持ち主 src/features/core/deviceFingerprint/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: 保持期間を半年にする `export default { collection: { retentionDays: 180 } } satisfies DeviceFingerprintOverride;`(収集を始めるのは src/config/featureGate/switches.config.ts の deviceFingerprint: true)
import type { DeviceFingerprintOverride } from "@/features/deviceFingerprint/config";

export default {} satisfies DeviceFingerprintOverride;
