# startup — サーバーの起動時の処理

## Overview

- サーバーの起動ごとに 1 回だけ走らせる処理(監視の SDK の初期化など)を、項目ごとに独立に走らせる芯。入口 `@/lib/startup`
- 一覧(増設点 `startupTasks` の項目)は知らない: 宣言 `./extensionPoints.ts`、一覧と結び目は生成物 `src/wiring/startup.ts`(`pnpm generate extensions`、D30・D31)。結び目は門番で閉じたドメインの項目を外して `wireStartup` に渡す。読み手は `src/instrumentation.ts` の `register` だけ
- 失敗の記録の送り先(`@/lib/serverErrorReport` の `serverErrorReporters`)から起動時の登録を分けた物(段 3、注文 33)。送り先は失敗を受けるだけ
- env を読まない(いまの runtime は結び目 `wire.ts` が Next の edge の目印 `globalThis.EdgeRuntime` で見る)
- fork は入口を書き換えず、項目を自分のドメインか lib の `plugs/startupTasks/<名前>.ts` に 1 ファイル 1 項目で足す。上流の項目は 0

## Usage

```ts
// src/lib/acmeMonitoring/plugs/startupTasks/sentry.ts(fork の lib の例。業務の処理なら <ドメイン>/plugs/startupTasks/)
import type { StartupTask } from "@/lib/startup";

export const task = {
  name: "sentry",
  runtime: "both",
  run: async () => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
  },
} satisfies StartupTask;
```

## API

- `createStartup(loaders, options)` → `{ register }`(throw しない Promise)
  - `loaders`: `{ name, load: () => Promise<StartupTask> }[]`
  - `options.runtime`: `"nodejs" | "edge"`(合わない項目を外す)| `timeoutMs`: 項目 1 つの上限 | `write`: 1 行の書き手(既定 console.error、test 用)
- `wireStartup({ startupTasks })`: 結び目の作り手(上限 `STARTUP_TIMEOUT_MS` = 10 秒、runtime は `currentRuntime()`)
- `StartupTask` = `{ name, runtime?: "nodejs" | "edge" | "both", run }`

## Extension

- `name`: 記録の行で項目を名指す名前 | `runtime`(既定 `nodejs`)
- 項目のファイルの最上位では Node 専用の物(`node:*`・firebase-admin・DB)を読まない。要る物は `run` の中で `import()`(入口は edge 向けにも束ねられる)
- 項目どうしは互いに依存しない(並べて走らせる。順番は無い)

## Internals

- 項目は lazy(生成物の一覧は `{ domain, name, requires, load }`)。register のときに読み、runtime の合う物を `Promise.all` で走らせる
- `runtime` が nodejs の項目(書かない・`"nodejs"`)は、生成物の load が `process.env.NEXT_RUNTIME === "nodejs"` の中で読む(点の宣言 `runtimeGuard: true`。edge の instrumentation の束に項目の読む物が入らない)。`runtime` は項目の中に字面で書く(生成器が字面を読む。`"edge"` / `"both"` の項目は条件なしで読む)
- 項目の throw・上限越え・読み込みの失敗 = 1 行 `{ level: "error", scope: "startup", task, phase: "load" | "run", reason }`。ほかの項目は止めない

## Verification

- `pnpm test src/lib/startup`(`createStartup.test.mts`: 項目ごとに独立、遅れ・throw・読み込みの失敗は別の 1 行、runtime の絞り込み)

## Related

- 失敗の記録: `src/lib/serverErrorReport/README.md` | 結線: `src/wiring/README.md`
