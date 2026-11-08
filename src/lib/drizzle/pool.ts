// src/lib/drizzle/pool.ts
//
// 設定から postgres(...) のオプションを組み、接続を作る(lib の中だけで使う。入口からは出さない)。
// 設定に無いキーは渡さない = postgres-js の既定のまま(空の上書きでは { prepare: false, max: 3 })。

import type postgres from "postgres";

import type { DrizzleConfig } from "./config";

type Connect = typeof postgres;

/** postgres-js に渡すオプション。prepare: false は固定(設定にしない) */
export function poolOptions(config: DrizzleConfig): postgres.Options<Record<string, postgres.PostgresType>> {
  return {
    prepare: false,
    max: config.max,
    ...(config.idleTimeout !== undefined ? { idle_timeout: config.idleTimeout } : {}),
    ...(config.connectTimeout !== undefined ? { connect_timeout: config.connectTimeout } : {}),
  };
}

/** 接続を作る。connect は postgres(テストでは偽物を渡す) */
export function createQueryClient(url: string, config: DrizzleConfig, connect: Connect): ReturnType<Connect> {
  return connect(url, poolOptions(config));
}
