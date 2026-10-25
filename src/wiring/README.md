# src/wiring — 登録表と lib の汎用関数を結ぶ場所

`src/lib` の汎用関数は登録表（`src/registry/*`）を import しない（lib → registry の依存を作らないため）。登録表を引数に渡して結んだ「印なし版」（server 用のそのまま使える関数）を置くのがこのフォルダ。業務コード（features）・部品（components）・lib は wiring を知らない。

## 目録（置いてよいファイル）

| ファイル | 結ぶもの | データに届くか |
|---|---|---|
| `domains.ts` | `serviceRegistry` + `domainConfigMap` → `getService` / `getServiceOrThrow` / `hasService` / `lookupDomainService` / `getDomainAccess` / `getDomainList` / `getDomainListWithCount` / `withRecordCounts` / `isValidDomainKey` / `getInvalidDomainKeys` | 届く（registry → domainEntry.ts → 遅延 import でサービスに届く） |

増やすときは、このテーブルと `wiring.test.mjs` の `WIRING_FILES` に足す。将来の API 用・管理画面用の wiring は自分で登録表を結ぶ（wiring どうしは import しない。共有するのは lib の汎用版と登録表だけ）。

## 向き（import してよい場所）

- `src/app/**`（API ルート・Screen・loader）、`src/proxies/**`、`src/proxy.ts`
- cron のフォルダ `src/app/api/cron/<name>/` では `task.ts` だけ（fork 所有の `override.ts` と 1 行の `route.ts` は不可）。task.ts の `run` の中で動的 import する（`const { lookupDomainService } = await import("@/wiring/domains")`）
- features / lib / components / registry からは import しない。lib がドメイン名からサービスを引きたいときは、呼び手（ルート）が wiring の関数を注入する（例: `src/lib/dataMigration` の `services` オプション、`storageObject` の sweep の `lookupService`）

「データに届く wiring」= services/server を値 import する wiring（判定は registry → domainEntry.ts → 遅延 import の鎖も辿る）。今は同じ場所からだけ import できる。

検査: `pnpm test:wiring`（目録・向き・鎖）。設計の全体は `src/lib/domain/README.md`。
