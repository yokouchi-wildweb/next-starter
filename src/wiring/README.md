# src/wiring — 登録表と lib の汎用関数を結ぶ場所

`src/lib` の汎用関数は登録表（`src/registry/*`）を引数で受ける。登録表を引数に渡して結んだ「印なし版」（server 用のそのまま使える関数）を置くのがこのフォルダ。業務コード（features）・部品（components）・lib は wiring を知らない。

**lib から新しく登録表を import しない**（lib → registry の依存を増やさない。引きたい lib は引数・注入で受ける）。既存の例外（今は直さない。全体の構造は別に扱う）:

- `src/lib/drizzle/index.ts` → `schemaRegistry`（DB クライアントに全表を渡す）
- `src/lib/domain/junction/getTable.ts` → `schemaRegistry`（中間表の名前 → 表）
- `src/lib/domain/config/getDomainConfig.ts` → `domainConfigRegistry`
- `src/lib/routeFactory/createDomainRoute.ts` → `serviceRegistry`（URL のドメイン名 → 行）
- `src/lib/routeFactory/createDeviceRoute.ts` → `pairedDeviceKindRegistry`（型だけ）
- `src/lib/dbAgent/{prompt.ts,service.ts,tools/index.ts}` → `dbAgentPromptRegistry` / `dbAgentToolRegistry`

## 目録（置いてよいファイル）

| ファイル | 結ぶもの | データに届くか |
|---|---|---|
| `domains.ts` | `serviceRegistry` + `domainConfigMap` → `getService` / `getServiceOrThrow` / `hasService` / `lookupDomainService` / `findDomainByTable` / `getDomainTable` / `getDomainAccess` / `getDomainList` / `getDomainListWithCount` / `withRecordCounts` / `isValidDomainKey` / `getInvalidDomainKeys` | 届く（registry → domainEntry.ts → 遅延 import でサービスに届く） |

増やすときは、このテーブルと `wiring.test.mjs` の `WIRING_FILES` に足す。将来の API 用・管理画面用の wiring は自分で登録表を結ぶ（wiring どうしは import しない。共有するのは lib の汎用版と登録表だけ）。

## 向き（import してよい場所）

- `src/app/**`（API ルート・Screen・loader）、`src/proxies/**`、`src/proxy.ts`
- cron のフォルダ `src/app/api/cron/<name>/` では `task.ts` だけ（fork 所有の `override.ts` と 1 行の `route.ts` は不可）。task.ts の `run` の中で動的 import する（`const { lookupDomainService } = await import("@/wiring/domains")`）
- features / lib / components / registry からは import しない。lib がドメイン名からサービスを引きたいときは、呼び手（ルート）が wiring の関数を注入する（例: `src/lib/dataMigration` の `services` オプション、`storageObject` の sweep の `lookupService`）

「データに届く wiring」= services/server を値 import する wiring（判定は registry → domainEntry.ts → 遅延 import の鎖も辿る）。今は同じ場所からだけ import できる。

検査: `pnpm test:wiring`（目録・向き・鎖）。設計の全体は `src/lib/domain/README.md`。
