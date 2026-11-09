// src/config/features/user.config.ts
// 利用者の設定の上書き(持ち主 src/features/core/user/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 値を変える: `export default { enableUserMemo: true, name: { unique: { enabled: true } } } satisfies UserOverride<Extra>;`
// 自分の鍵を足す: 下の Extra に `<鍵>: <型>` を足し、値を書く(userConfig.<鍵> で読める)
import type { UserOverride } from "@/features/user/config";

export type Extra = Record<never, never>;

export default {} satisfies UserOverride<Extra>;
