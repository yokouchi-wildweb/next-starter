// src/config/features/pairedDevice.config.ts
// 登録端末の設定の上書き(持ち主 src/features/core/pairedDevice/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: 端末トークンを 90 日にする `export default { token: { maxAgeDays: 90 } } satisfies PairedDeviceOverride;`
// 機能の入切(enabled)はここではなく src/config/app/paired-device.config.ts(門番の議会が移すまで)
import type { PairedDeviceOverride } from "@/features/core/pairedDevice/config";

export default {} satisfies PairedDeviceOverride;
