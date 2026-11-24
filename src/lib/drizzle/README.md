# drizzle

## Overview

- PostgreSQL(Neon)のクライアント `db`・トランザクションの道具(`runWithTransaction`・`TransactionClient`)・未設定の判定(`isDatabaseConfigured`・`DatabaseNotConfiguredError`)
- 閉じた lib(入口 `@/lib/drizzle`。`package.json` の `libs` = `defineConfig`)。server 専用(`server-only`)
- 決まり(入口・プールの値・process.env を読まない・prepare の固定)は札 `.claude/rules/items/lib/drizzle.md`。未設定のときの約束は CLAUDE.md BACKENDS unconfigured

## API

入口 `@/lib/drizzle` が出す物:

- `db`: drizzle の DB(postgres-js)。`DATABASE_URL` が空なら、どのプロパティに触れても `DatabaseNotConfiguredError` を投げる代わりの物(import だけなら投げない)
- `isDatabaseConfigured()`: `DATABASE_URL` が trim して空でないか。判定は「未設定」だけで、設定済みで繋がらないときは例外のまま
- `DatabaseNotConfiguredError`: 未設定で DB に触れたときの誤り(接続を待たずにすぐ失敗する)。共通の親 `BackendNotConfiguredError`(`@/lib/errors`)を継ぐ(`port` `"database"`、`missing` `["DATABASE_URL"]`、`side` `"server"`)
- `runWithTransaction(tx, handler)`: `tx` があればそのまま使い、無ければ新しいトランザクションを始めて `handler` を呼ぶ
- `TransactionClient`: `db.transaction()` のコールバックの引数の型
- `DrizzleOverride`: 上書きのファイルの型
- 接続は 1 プロセスに 1 つ(`globalThis` に持ち、開発の HMR で作り直さない)

## Extension

接続プールの値は上書きのファイル `src/config/lib/drizzle.config.ts`(`@lib-config/drizzle`)で変える。届け方: [../README.md](../README.md)「設定の届け方」。

- `max` → postgres-js の `max`(プールの最大接続数)。既定 `3`
- `idleTimeout` → `idle_timeout`(秒)。書かない = postgres-js の既定
- `connectTimeout` → `connect_timeout`(秒)。書かない = postgres-js の既定
- 0・負・小数は読み込み時に `ConfigValidationError`
- 上流の上書きは空(`export default {} satisfies DrizzleOverride;`)= `{ prepare: false, max: 3 }`

```ts
// src/config/lib/drizzle.config.ts(fork の例)
import type { DrizzleOverride } from "@/lib/drizzle";

export default { max: 50, idleTimeout: 20, connectTimeout: 10 } satisfies DrizzleOverride;
```

## Verification

- `pnpm test src/lib/drizzle`(`config.test.ts`。偽のドライバでオプションの届き方と検査)
