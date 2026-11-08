// src/config/layout/root.config.ts
// root の枠(全ページの一番外側)の設定の上書き(持ち主 src/app/_layout/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
import type { RootLayoutOverride } from "@/app/_layout/config";

export default {} satisfies RootLayoutOverride;
