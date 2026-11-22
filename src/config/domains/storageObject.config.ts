// src/config/domains/storageObject.config.ts
// ファイルの台帳の運用値の上書き（持ち主 src/domains/core/storageObject/config.ts だけが読む）。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 値の照合で外して消す: `export default { sweep: { reconcile: { valueCheck: "detach" } } } satisfies StorageObjectOverride;`
import type { StorageObjectOverride } from "@/domains/storageObject/config";

export default {} satisfies StorageObjectOverride;
