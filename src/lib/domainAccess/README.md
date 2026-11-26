# src/lib/domainAccess — 汎用ドメイン API と管理データ操作の権限の型と定型

## Overview

- 登録表の各行が持つ `access`(`DomainApiAccessConfig`)の型・操作名(`DOMAIN_CRUD_OPERATIONS` / `DOMAIN_DATA_OPERATIONS` / `DATA_COMMANDS`)・定型(`ADMIN_ONLY` など)。閉じた lib で、入口は `.`(`@/lib/domainAccess`)だけ。依存なし(`package.json` の `libs` は無い)
- 値だけのファイルだけで作る: 登録表 `src/registry/serviceRegistry.ts` と fork の `entities/<登録名>/entity.override.ts` がここを値で読み、`pnpm check registry` が上書きの読み込み先を推移的に確かめる(関数・呼び出し・`class`・副作用の import を置かない。決まり: `src/lib/domain/README.md`「Extension」)
- 権限の解決(`resolveAccessRule`・`isGenericApiClosed`・`resolveDataCommand`)は `@/lib/domain`。この lib は形と値だけを持つ

## Usage

```ts
// src/domains/core/<domain>/entities/<登録名>/entity.override.ts(fork が core の登録の access を変える)
import type { EntityOverride } from "@/lib/domain";
import { ADMIN_ONLY } from "@/lib/domainAccess";

export const entityOverride = { apiAccess: ADMIN_ONLY } satisfies EntityOverride;
```

## API

- 型: `DomainApiAccessConfig`(read / write / operations / commands)・`DomainApiAccessRule`・`DomainApiRoleRule`・`DomainApiOperation` / `DomainCrudOperation` / `DomainDataOperation`・`DataCommand` / `DataCommandOverride`(`apiAccess.ts`)
- 操作名: `DOMAIN_CRUD_OPERATIONS`・`DOMAIN_DATA_OPERATIONS`(truncateAll / export / import)・`DOMAIN_API_OPERATIONS`・`DATA_COMMANDS`(`apiAccess.ts`)
- 定型(`accessPresets.ts`、上書きできる設定ではない): `ADMIN_ONLY` / `PUBLIC_READ` / `ADMIN_OR_DEBUGGER` / `INTERNAL_ONLY`・単一ルール `ADMIN_RULE` / `ADMIN_OR_DEBUGGER_RULE`・`ADMIN_DATA_OPERATIONS`・既定 `DEFAULT_ACCESS_RULE`(admin カテゴリだけ、書き漏れの fail-closed)。意味の表: `src/lib/domain/API.md`「access のプリセット」

## Internals

- 生成器の写し: `scripts/structure/registry/serviceRegistry/access.mjs` が定型を写し、生成する登録表の import 先を `@/lib/domainAccess` にする(値の一致は `pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs`)
- 入口 `index.ts` は名前を 1 つずつ書く(`export *` にしない: tsx でテストが入口を読むとき名前が見えなくなる)
