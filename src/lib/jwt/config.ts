// src/lib/jwt/config.ts
//
// JWT セッションの設定(既定 + 上書き)。上書きは src/config/lib/jwt.config.ts(@lib-config/jwt)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// 署名のアルゴリズム(SESSION_JWT_ALGORITHM)は検証の仕組みと組なので constants.ts の定数のまま。

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/jwt";

export type JwtConfig = {
  /** JWT セッションを保持するクッキー名(SESSION_COOKIE_NAME) */
  cookieName: string;
  /** セッショントークンの既定の有効期限(秒、SESSION_DEFAULT_MAX_AGE_SECONDS) */
  defaultMaxAgeSeconds: number;
};

const defaults: JwtConfig = {
  cookieName: "__session",
  defaultMaxAgeSeconds: 60 * 60 * 24 * 7,
};

export const jwtConfigDef = defineConfig(defaults, { label: "jwt" });

/** 上書きのファイルの型(`export default { ... } satisfies JwtOverride`) */
export type JwtOverride<E extends object = Record<never, never>> = OverrideOf<typeof jwtConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const jwtConfig: JwtConfig = jwtConfigDef.compose(override);
