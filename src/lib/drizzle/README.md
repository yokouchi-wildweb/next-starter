# drizzle

PostgreSQL(Neon)のクライアント `db`・トランザクションの道具(`runWithTransaction`・`TransactionClient`)・未設定の判定(`isDatabaseConfigured`・`DatabaseNotConfiguredError`)。閉じた lib(入口 `@/lib/drizzle` だけを読む。`package.json` の `libs` = `defineConfig`)。server 専用(`server-only`)。

## 接続プールの設定

値は上書きのファイル `src/config/lib/drizzle.config.ts`(`@lib-config/drizzle`)で変える。lib の中は `process.env` を読まない(上書きのファイルは読んでよい)。届け方: [../README.md](../README.md)「設定の届け方」。

| キー | postgres-js のオプション | 既定 |
| --- | --- | --- |
| `max` | `max`(プールの最大接続数) | `3` |
| `idleTimeout` | `idle_timeout`(秒) | 書かない = postgres-js の既定 |
| `connectTimeout` | `connect_timeout`(秒) | 書かない = postgres-js の既定 |

- 値は正の整数(0・負・小数は読み込み時に `ConfigValidationError`)
- `prepare: false` は固定(設定にしない)
- 上流の上書きは空(`export default {} satisfies DrizzleOverride;`)= `{ prepare: false, max: 3 }`

```ts
// src/config/lib/drizzle.config.ts(fork の例)
import type { DrizzleOverride } from "@/lib/drizzle";

export default { max: 50, idleTimeout: 20, connectTimeout: 10 } satisfies DrizzleOverride;
```

## ファイル

- `index.ts` 入口(`db`・トランザクション・未設定の判定・`DrizzleOverride` の型)
- `config.ts` 設定の既定・検査・合成 | `pool.ts` 設定から postgres(...) のオプションを組む(中だけ)
- `config.test.ts` `pnpm test src/lib/drizzle`(偽のドライバでオプションの届き方と検査)
