// src/config/layout/root.config.ts
// root の枠(全ページの一番外側)の設定の上書き(持ち主 src/app/_layout/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 深い合成: 書かないキーは持ち主の既定が残る(viewport.viewportFit の既定は "cover")。端まで描かないなら `export default { viewport: { viewportFit: "auto" } } satisfies RootLayoutOverride;`
import type { RootLayoutOverride } from "@/app/_layout/config";

export default {} satisfies RootLayoutOverride;
