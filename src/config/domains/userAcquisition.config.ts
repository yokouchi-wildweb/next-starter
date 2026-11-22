// src/config/domains/userAcquisition.config.ts
// 流入経路の設定の上書き(持ち主 src/domains/core/userAcquisition/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: `export default { cookieMaxAgeDays: 60, maxTouches: 10 } satisfies UserAcquisitionOverride;`
// 記録するかは門番の規則 userAcquisition の入切(pnpm ops features set userAcquisition on → src/config/featureGate/switches.config.ts)
import type { UserAcquisitionOverride } from "@/domains/userAcquisition/config";

export default {} satisfies UserAcquisitionOverride;
