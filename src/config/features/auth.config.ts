// src/config/features/auth.config.ts
// 認証の設定の上書き(持ち主 src/features/core/auth/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 値を変える: `export default { thirdPartyProviders: { google: true } } satisfies AuthOverride<Extra>;`
// 自分の鍵を足す: 下の Extra に `<鍵>: <型>` を足し、値を書く(authConfig.<鍵> で読める)
import type { AuthOverride } from "@/features/auth/config";

export type Extra = Record<never, never>;

export default {} satisfies AuthOverride<Extra>;
