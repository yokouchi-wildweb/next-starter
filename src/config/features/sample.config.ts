// src/config/features/sample.config.ts
// サンプルのドメインの設定の上書き(持ち主 src/features/sample/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
import type { SampleOverride } from "@/features/sample/config";

export default {} satisfies SampleOverride;
