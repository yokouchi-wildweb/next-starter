// src/config/domains/legal.config.ts
// 法務の文書の設定の上書き(持ち主 src/domains/core/legal/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 文書を自分の文面にする: pnpm ops legal from-example [terms|privacy|tradelaw](例文を写して own にする)の後に直す。形: src/domains/core/legal/README.md
import type { LegalOverride } from "@/domains/legal/config";

export default {} satisfies LegalOverride;
