# serverErrorReport — サーバーの失敗の既定の記録と送り先への配送

## Overview

- サーバーの失敗を既定の記録(console.error に JSON 1 行)に必ず残し、その後に送り先の項目へ互いに独立に配る芯。入口 `@/lib/serverErrorReport`
- 一覧(受け口の項目)は知らない: 呼び手が `{ name, load }` の配列を渡す。結ぶのは `src/wiring/serverErrors`(入口 `src/instrumentation.ts`)
- env を読まない(いまの runtime は呼び手が渡す)

## Usage

```ts
import { createServerErrorReport } from "@/lib/serverErrorReport";

const report = createServerErrorReport(reporters, { runtime: "nodejs", timeoutMs: 1500, registerTimeoutMs: 10000 });

export const register = report.register; // Next の register
export const onRequestError = report.onRequestError; // Next の onRequestError

// 入口が自分で受け止めた失敗(API の Factory・cron・proxy)
await report.report(error, { scope: "api", path: request.nextUrl.pathname, method: request.method, requestId });
```

## API

- `createServerErrorReport(loaders, options)` → `{ register, onRequestError, report }`(どれも throw しない Promise)
  - `loaders`: `{ name, load: () => Promise<ServerErrorReporter> }[]`
  - `options.runtime`: `"nodejs" | "edge"`(合わない項目を外す)| `timeoutMs`: 項目の onRequestError の上限 | `registerTimeoutMs`: 項目の register の上限 | `write`: 1 行の書き手(既定 console.error、test 用)
- `report(error, input)`: `input` = `{ scope: "api" | "cron" | "proxy" | "request", path, method, headers?, routePath?, routeType?, requestId?, name? }`。既定の行の後、項目へ Next と同じ形の引数(`routerKind: "App Router"`、routeType 既定 = proxy なら `proxy`、他は `route`)で配る
- `ServerErrorReporter` = `{ name, runtime?: "nodejs" | "edge" | "both", register?, onRequestError? }`
- `stripQuery(path)`: クエリと断片を外す

## Internals

### 既定の 1 行

- `{ level: "error", scope, path, method, routePath?, routeType?, renderSource?, digest?, requestId?, name?, error: { name, message, stack? } }`
- path はクエリと断片を外す。headers・cookie・body は書かない。Error でない値は `{ name: "NonError", message: String(値) }`
- 直列化は循環を `"[circular]"`、BigInt を文字列にする。それでも失敗したら `{ level, scope: "serverErrorReport", reason: "unserializable" }`

### 失敗のとき

- 既定の行を必ず先に書いてから項目へ配る。項目ごとに catch と上限(`Promise.race`、上限越えは待つのをやめるだけで続きは止めない)
- 項目の throw・上限越え・読み込みの失敗 = 別の 1 行 `{ level: "error", scope: "serverErrorReport", reporter, phase: "load" | "register" | "onRequestError", reason }`
- 書き手の throw は飲む。項目の読み込みは 1 回だけ(失敗した項目は以後外す)

### 既知の限界

- 上限を越えた項目は裏で動き続けうる(止める手段が無い)
- Next の制御の throw(redirect / notFound)は Next が onRequestError に渡さないので記録されない。cacheComponents の build の prerender の失敗も渡されない

## Verification

- `createServerErrorReport.test.mts`: 既定の行が先で秘密を書かない・項目の throw / 遅れ / 読み込みの失敗が他を止めない・循環と BigInt・runtime の絞り込み・register・入口の report

## Related

- `src/wiring/serverErrors/README.md`(受け口・呼ばれる時機・項目の書き方)
