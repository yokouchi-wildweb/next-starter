# src/lib/httpDefaults — client の HTTP の既定

## Overview

- client の axios の呼び出しのうち、自分のタイムアウトを持たない物に、アプリ全体の既定のタイムアウトを付ける閉じた lib。既定は「付けない」(今までの振る舞い)
- 使う時・直す時の決まりは札 .claude/rules/items/lib/httpDefaults.md にある。この README は使い方と仕組み

## API

- 入口 `@/lib/httpDefaults`(1 つだけ): 合成済みの設定 `httpDefaultsConfig`(と `httpDefaultsConfigDef`)・型 `HttpDefaultsConfig` / `HttpDefaultsOverride`・`installHttpDefaults(instance, timeoutMs)`(interceptor を 1 つ登録する。前の登録があれば外してから)・`applyDefaultTimeout(request, timeoutMs)`(1 つの要求に既定を当てる純関数)
- 同じ入口の client の部品 `<HttpDefaultsRoot />`(何も描かない。`"use client"` のファイルで、読み込まれた時に 1 回登録する)

## Extension

```ts
// src/config/lib/httpDefaults.config.ts(@lib-config/httpDefaults)
import type { HttpDefaultsOverride } from "@/lib/httpDefaults";

export default { timeoutMs: 30_000 } satisfies HttpDefaultsOverride; // 上流は {}(= timeoutMs: null、付けない)
```

## Internals

- 既定の axios インスタンス(`import axios from "axios"`)への request interceptor 1 つ。登録は `src/wiring/AppProviders.tsx` の入れ子の `HttpDefaultsRoot`(client の部品、読み込み時に 1 回。開発の再読み込みでも二重にならない)
- 付けるのは、呼び出しの `timeout` が無い(未指定か 0)ときだけ。呼び出しの値(CRUD の通常の操作の 60 秒など)が優先
- 上限を付けない印 `defaultTimeout: false` は、この lib が axios の `AxiosRequestConfig` を型で拡張して足す。CRUD の bulk*・replaceByQuery・duplicate が書いている
- `axios.create` のインスタンスには付かない(lib/storage の GCS への直接の転送など)
- 時間切れの書き込みはサーバー側で終わっていることがある

## Verification

- `pnpm test src/lib/httpDefaults`(付け方・二重の登録・axios.create と defaults が変わらないこと)
