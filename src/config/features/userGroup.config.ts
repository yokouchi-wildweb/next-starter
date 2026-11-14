// src/config/features/userGroup.config.ts
// ユーザーグループの値の上書き(持ち主 src/features/core/userGroup/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: 人数の上限を上げる `export default { memberLimit: 300000 } satisfies UserGroupOverride;`
import type { UserGroupOverride } from "@/features/userGroup/config";

export default {} satisfies UserGroupOverride;
