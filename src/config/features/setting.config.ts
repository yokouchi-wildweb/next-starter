// src/config/features/setting.config.ts
// 設定ドメインの設定の上書き(持ち主 src/features/core/setting/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// メンテナンス中も通すパスを変える: `export default { maintenance: { allowedPaths: ["/maintenance", "/login", …] } } satisfies SettingOverride;`(配列は丸ごと置き換わる)
import type { SettingOverride } from "@/features/setting/config";

export default {} satisfies SettingOverride;
