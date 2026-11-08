// src/lib/drizzle/config.ts
//
// drizzle の接続プールの設定(既定 + 上書き)。上書きは src/config/lib/drizzle.config.ts(@lib-config/drizzle)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// prepare: false は設定にしない(pool.ts で固定)。値は lib の中で process.env から読まない(上書きのファイルは読んでよい)。

import { z } from "zod";

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/drizzle";

export type DrizzleConfig = {
  /** プールの最大接続数(postgres-js の max) */
  max: number;
  /** 使われない接続を閉じるまでの秒数(postgres-js の idle_timeout)。書かない = postgres-js の既定 */
  idleTimeout?: number;
  /** 接続の確立を待つ秒数(postgres-js の connect_timeout)。書かない = postgres-js の既定 */
  connectTimeout?: number;
};

const defaults: DrizzleConfig = { max: 3 };

const positiveInt = z.number().int().positive();

/** 合成した値の検査(正の整数。fork 独自のキーは通す) */
const schema = z
  .object({ max: positiveInt, idleTimeout: positiveInt.optional(), connectTimeout: positiveInt.optional() })
  .passthrough();

export const drizzleConfigDef = defineConfig(defaults, { label: "drizzle", schema });

/** 上書きのファイルの型(`export default { ... } satisfies DrizzleOverride`) */
export type DrizzleOverride<E extends object = Record<never, never>> = OverrideOf<typeof drizzleConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const drizzleConfig: DrizzleConfig = drizzleConfigDef.compose(override);
