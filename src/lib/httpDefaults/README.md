# src/lib/httpDefaults — client の HTTP の既定

client の axios の呼び出しのうち、自分のタイムアウトを持たない物に、アプリ全体の既定のタイムアウトを付ける閉じた lib です(設定の議会 D62、依頼 20261104-164647-app-wide-http-default-timeout)。既定は「付けない」(今までの振る舞い)。

## 設定

```ts
// src/config/lib/httpDefaults.config.ts(@lib-config/httpDefaults)
import type { HttpDefaultsOverride } from "@/lib/httpDefaults";

export default { timeoutMs: 30_000 } satisfies HttpDefaultsOverride; // 上流は {}(= timeoutMs: null、付けない)
```

## 効き方

- 既定の axios インスタンス(`import axios from "axios"`)への request interceptor 1 つ。登録は `src/wiring/AppProviders.tsx` の入れ子の `HttpDefaultsRoot`(client の部品、読み込み時に 1 回。開発の再読み込みでも二重にならない)
- 付けるのは、呼び出しの `timeout` が無い(未指定か 0)ときだけ。呼び出しの値(CRUD の通常の操作の 60 秒など)が優先
- 意図して上限を付けない呼び出しは `defaultTimeout: false` を書く(この lib が axios の `AxiosRequestConfig` を型で拡張する。CRUD の bulk*・replaceByQuery・duplicate が書いている)。axios は「未指定」と「0」を見分けられないので印が要る
- `axios.defaults` は書き換えない(`axios.create` は作った時の defaults を写すので、lib/storage の GCS への直接の転送などに上限が漏れる)。`axios.create` のインスタンスには付かない
- server の fetch は対象外。リトライはしない(書き込みの二重の実行を避ける)。時間切れの書き込みはサーバー側で終わっていることがある

## テスト

`pnpm test src/lib/httpDefaults`(付け方・二重の登録・axios.create と defaults が変わらないこと)
