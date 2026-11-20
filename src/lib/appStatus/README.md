# appStatus

## Overview

- 長く居る画面で、メンテナンスと新しいデプロイを見張る `useAppStatus()`(`@/lib/appStatus`)。`/api/health` を定期的に読む
- 既定の動き: メンテナンスで止められたらメンテナンスの道へ移り、新しいデプロイなら読み直す。動きはコールバックで替えられる
- 閉じた lib(入口 `.` だけ)。読む lib は `defineConfig` だけ(設定の合成)。ルーターは読まない

## Usage

```tsx
"use client";

import { useAppStatus } from "@/lib/appStatus";

export function LongStayScreen() {
  useAppStatus();
  // …
}
```

- client 部品の先頭で 1 回呼ぶ。何も描かない
- 間隔・止める: `useAppStatus({ intervalMs: 10_000, enabled: isPlaying })`
- 動きを替える: `useAppStatus({ onMaintenance: () => showNotice(), onNewDeploy: () => setUpdateAvailable(true) })`(渡したほうだけ既定の動きに替わる)

## API

- `useAppStatus(options?)`: 戻り値なし
  - `intervalMs`(既定 = 設定の `intervalMs`)・`enabled`(既定 true)
  - `onMaintenance`: 止められた時。無ければ `window.location.assign(maintenancePath)`(全体の読み込みなので proxy のメンテナンスの門を通る)
  - `onNewDeploy`: 最初に読んだ buildId と変わった時。無ければ `window.location.reload()`
- 型: `AppStatusResponse`(`/api/health` の応答。`buildId`・`maintenance { active, bypassed }`。route は `satisfies` で合わせる)・`UseAppStatusOptions`・`AppStatusEvent`・`AppStatusConfig`・`AppStatusOverride`
- 止められる = `active && !bypassed`(bypass の判定は `/api/health` 側で proxy と同じ)。応答が ok でない・通信の失敗は何もしない

## Extension

上書きは `src/config/lib/appStatus.config.ts`(合成の決まり: [../defineConfig/README.md](../defineConfig/README.md))。

- `healthPath` = 状態を読む道(既定 `"/api/health"`)
- `maintenancePath` = 止められた時に移る道(既定 `"/maintenance"`)
- `intervalMs` = 確かめる間隔の既定(既定 `30000`)

```ts
import type { AppStatusOverride } from "@/lib/appStatus";

export default { maintenancePath: "/closed" } satisfies AppStatusOverride;
```

## Verification

- 設定の上書きと、1 回の応答から起きたことの判定: `pnpm test src/lib/appStatus`

## Related

- 状態を返す route: `src/app/api/health/route.ts`
- メンテナンスの門: `src/proxies/maintenance.ts`
