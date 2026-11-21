# サーバーの失敗の記録と送り先

## Overview

- サーバーで起きた失敗を、既定の記録(console.error に JSON 1 行)に必ず残し、その後に送り先の項目(fork が自分の監視をつなぐ: Sentry など)へ配る受け口
- 入口は上流の薄い `src/instrumentation.ts`(Next の `register` / `onRequestError`)。fork は入口を書き換えず、送り先を `reporters/<名前>.ts` に 1 ファイル 1 項目で足す
- `pnpm generate extensions`(forge が回す)が一覧 `extensions/reporters.ts` を作る。上流の項目は 0
- 芯は閉じた lib `src/lib/serverErrorReport`(既定の行・配送・待ち時間の上限)。一覧を lib に渡して結ぶのが `index.ts`

## Usage

### 呼ばれる時機

- `register`: サーバーの起動ごとに 1 回(Next が待つ)。各項目の `register` を互いに独立に呼ぶ(上限 10 秒)
- `onRequestError`: Next がサーバーの失敗を受けたとき(描画の殻の前・殻を流した後・server action・route handler)。redirect / notFound など Next の制御の throw は Next が除き、呼ばれない
- proxy の throw は Next から呼ばれない。API の Factory と cron は失敗を応答に変えるので Next に届かない。この 3 つは入口が `serverErrorReport.report` で同じ記録へ渡す(route factory・cron・proxy の受け止め)

### 既定の 1 行

```json
{"level":"error","scope":"request","path":"/mypage","method":"GET","routePath":"/mypage","routeType":"render","renderSource":"react-server-components","digest":"123","error":{"name":"Error","message":"…","stack":"…"}}
```

- `scope`: `request`(Next の onRequestError)| `api` | `cron` | `proxy`(入口の受け止め)。cron の既存の行と同じ語彙 `level` / `scope`
- `path` はクエリと断片を外す。headers・cookie・body は書かない(項目には Next の引数をそのまま渡す)
- 入口の受け止めは `requestId`(監査の文脈と同じ値)と `name`(cron のタスク名など)を足す
- digest は Next が利用者の画面に出す番号。画面の番号から行を探せる

### 失敗のとき

- 既定の行を必ず先に書く。項目は互いに独立(`Promise.all` の中で 1 項目ずつ catch)
- 項目の throw・上限越え(onRequestError 1.5 秒・register 10 秒)・読み込みの失敗は、別の 1 行 `{"level":"error","scope":"serverErrorReport","reporter":"<名前>","phase":"load|register|onRequestError","reason":…}` に書き、他の項目と既定の行は止めない。上限を越えた項目の続きは止めない(待つのをやめるだけ)
- `register` / `onRequestError` / `report` は throw しない。直列化は循環・BigInt でも 1 行を返す
- tx(DB の取引)は持たない。記録は DB に書かない

## Extension

```ts
// src/wiring/serverErrors/reporters/sentry.ts(fork の例)
import type { ServerErrorReporter } from "@/lib/serverErrorReport";

export const reporter = {
  name: "sentry",
  runtime: "both",
  register: async () => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
  },
  onRequestError: async (error, request, context) => {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(error, request, context);
  },
} satisfies ServerErrorReporter;
```

- `name`: 記録の行で項目を名指す名前
- `runtime`(既定 `nodejs`): `nodejs` | `edge` | `both`。合わない runtime では読み込んだ後に外す
- `register` / `onRequestError`: どちらも任意。引数は Next の `onRequestError` と同じ(`@sentry/nextjs` の `captureRequestError` はそのまま渡せる)
- 項目のファイルの最上位では Node 専用の物(`node:*`・firebase-admin・DB)を読まない。要る物は関数の中で `import()`(入口は edge 向けにも束ねられる)
- 送り先の待ち時間は route handler の応答の遅れになる(Next が待つ)。送り先が遅いなら項目の中で送りを待たない形にする

## Internals

- 一覧 `extensions/reporters.ts`(生成物)は `{ name, load }` の配列。項目は最初の失敗(か register)のときに 1 回だけ読む。読み込みに失敗した項目は以後外す
- 受け口の宣言は `extensionPoints.ts` の `reporters`(`side: "server"`・`load: "lazy"`)
- いまの runtime は `index.ts` が `process.env.NEXT_RUNTIME` から lib に渡す(閉じた lib は env を読まない)
- fork の入口: `src/instrumentation.ts` は上流の版を取る(自前の register・onRequestError は項目へ移す)

## Related

- `src/lib/serverErrorReport/README.md`(芯の API)
- `src/lib/cron/README.md`(cron の記録の行)
- Next の instrumentation: `node_modules/next/dist/docs/` の instrumentation と onRequestError
