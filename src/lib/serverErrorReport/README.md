# serverErrorReport — サーバーの失敗の既定の記録と送り先への配送

## Overview

- サーバーの失敗を既定の記録(console.error に JSON 1 行)に必ず残し、その後に送り先の項目へ互いに独立に配る芯。入口 `@/lib/serverErrorReport`
- 一覧(増設点 `serverErrorReporters` の項目)は知らない: 宣言 `./extensionPoints.ts`、一覧と結び目は生成物 `src/wiring/serverErrorReport.ts`(`pnpm generate extensions`)。結び目は門番で閉じたドメインの項目を外して `wireServerErrorReport` に渡す。読み手は `src/instrumentation.ts`(Next の onRequestError。register は起動時の処理 `@/lib/startup`)・`src/proxy.ts`・API の Factory・cron
- env を読まない(いまの runtime は結び目 `wire.ts` が Next の edge の目印 `globalThis.EdgeRuntime` で見る。`createServerErrorReport` を直に使う呼び手は自分で渡す)
- fork は入口を書き換えず、送り先を自分のドメインか lib の `plugs/serverErrorReporters/<名前>.ts` に 1 ファイル 1 項目で足す。上流の項目は 0

## Usage

```ts
import { createServerErrorReport } from "@/lib/serverErrorReport";

const report = createServerErrorReport(reporters, { runtime: "nodejs", timeoutMs: 1500 });

export const onRequestError = report.onRequestError; // Next の onRequestError

// 入口が自分で受け止めた失敗(API の Factory・cron・proxy)
await report.report(error, { scope: "api", path: request.nextUrl.pathname, method: request.method, requestId });
```

## API

- `createServerErrorReport(loaders, options)` → `{ onRequestError, report }`(どれも throw しない Promise)
  - `loaders`: `{ name, load: () => Promise<ServerErrorReporter> }[]`
  - `options.runtime`: `"nodejs" | "edge"`(合わない項目を外す)| `timeoutMs`: 項目の onRequestError の上限 | `write`: 1 行の書き手(既定 console.error、test 用)
- `report(error, input)`: `input` = `{ scope: "api" | "cron" | "proxy" | "request", path, method, headers?, routePath?, routeType?, requestId?, name?, extra? }`(`extra` = 既定の行に足す数・文字・真偽。既定のキーは書けない)。既定の行の後、項目へ Next と同じ形の引数(`routerKind: "App Router"`、routeType 既定 = proxy なら `proxy`、他は `route`)で配る
- `ServerErrorReporter` = `{ name, runtime?: "nodejs" | "edge" | "both", onRequestError? }`(起動時の初期化は起動時の処理の点 `startupTasks` の項目に分ける、`src/lib/startup/README.md`)
- `stripQuery(path)`: クエリと断片を外す

## Extension

```ts
// src/lib/acmeMonitoring/plugs/serverErrorReporters/sentry.ts(fork の lib の例。業務の送り先なら <ドメイン>/plugs/serverErrorReporters/)
import type { ServerErrorReporter } from "@/lib/serverErrorReport";

export const reporter = {
  name: "sentry",
  runtime: "both",
  onRequestError: async (error, request, context) => {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(error, request, context);
  },
} satisfies ServerErrorReporter;
// 初期化(Sentry.init)は同じ lib の plugs/startupTasks/sentry.ts に(src/lib/startup/README.md の例)
```

- `name`: 記録の行で項目を名指す名前 | `runtime`(既定 `nodejs`): `nodejs` | `edge` | `both`。合わない runtime では読み込んだ後に外す
- `onRequestError`: 任意。引数は Next の `onRequestError` と同じ(`@sentry/nextjs` の `captureRequestError` はそのまま渡せる)
- 項目のファイルの最上位では Node 専用の物(`node:*`・firebase-admin・DB)を読まない。要る物は関数の中で `import()`(入口は edge 向けにも束ねられる)
- 送り先の待ち時間は route handler の応答の遅れになる(Next が待つ)。送り先が遅いなら項目の中で送りを待たない形にする
- 呼ばれる時機: `onRequestError` = Next がサーバーの失敗を受けたとき(上限 1.5 秒。redirect / notFound など Next の制御の throw は呼ばれない)| proxy の throw・API の Factory・cron の失敗は入口が `serverErrorReport.report` で同じ記録へ渡す
- 約束の型は入口 `@/lib/serverErrorReport` から `import type` で読む

## Internals

- 項目は lazy(生成物の一覧は `{ domain, name, requires, load }`)。最初の失敗のときに 1 回だけ読む。限界: `import()` の先も edge 用の instrumentation の束に入る(Turbopack)。edge の関数を足す fork は項目のファイルの最上位を軽く保つ

### 既定の 1 行

- `{ level: "error", scope, path, method, routePath?, routeType?, renderSource?, digest?, requestId?, name?, error: { name, message, stack? } }`
- path はクエリと断片を外す。headers・cookie・body は書かない。Error でない値は `{ name: "NonError", message: String(値) }`
- 直列化は循環を `"[circular]"`、BigInt を文字列にする。それでも失敗したら `{ level, scope: "serverErrorReport", reason: "unserializable" }`

### 失敗のとき

- 既定の行を必ず先に書いてから項目へ配る。項目ごとに catch と上限(`Promise.race`、上限越えは待つのをやめるだけで続きは止めない)
- 項目の throw・上限越え・読み込みの失敗 = 別の 1 行 `{ level: "error", scope: "serverErrorReport", reporter, phase: "load" | "onRequestError", reason }`
- 書き手の throw は飲む。項目の読み込みは 1 回だけ(失敗した項目は以後外す)

### 既知の限界

- 上限を越えた項目は裏で動き続けうる(止める手段が無い)
- Next の制御の throw(redirect / notFound)は Next が onRequestError に渡さないので記録されない。cacheComponents の build の prerender の失敗も渡されない

## Verification

- `createServerErrorReport.test.mts`: 既定の行が先で秘密を書かない・項目の throw / 遅れ / 読み込みの失敗が他を止めない・循環と BigInt・runtime の絞り込み・入口の report

## Related

- `src/wiring/serverErrorReport.ts`(生成物: 一覧と結び目)・`src/instrumentation.ts`(Next の入口)
- `src/lib/cron/README.md`(cron の記録の行)
