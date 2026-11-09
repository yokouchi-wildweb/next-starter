# src/app/_providers

アプリ全体の Provider の入れ子(`src/wiring/AppProviders.tsx`)の一番内側に入る fork の口。root の `src/app/layout.tsx` が全ページで描くので、`/entry` などの枠の外のページにも届く。

## 形(1 行スイッチ・丸ごとの置き換え)

- `ForkProviders.tsx` = 呼び手(`AppProviders`)が import する 1 行スイッチ。上流は `./ForkProviders.default` を指す
- `ForkProviders.default.tsx` = 上流の既定。children をそのまま返す空の素通し。編集しない
- fork は隣に `ForkProviders.replace.tsx` を書き、スイッチの 1 行を `./ForkProviders.replace` へ向ける
- 検査: `pnpm check extensions`(`scripts/structure/extensions/switches.mjs`。Tier1 のスイッチは `.default` を指す、孤立した `.replace` は失敗)。受け口の行(スイッチ = edit、`.replace` = add)は `pnpm generate extensions` が書く

## `.replace` の書き方

- `ForkProviders` を同じ名前で export する。props は `{ children: ReactNode }`(型は `ForkProvidersProps` を `./ForkProviders.default` から import してよい)
- このファイル自体は server component のまま。`"use client"` の Provider を import して children を包む(client 境界はその Provider になる)
- 全ページに出す client 部品(同意バナーなど)は children の隣に描く
- ここでデータを取らない(サーバーのデータは loader から props で)
- 多段の Tier も同じ `.replace` を書き換える。親の Tier の Provider を残すかは下の Tier が決める

```tsx
// src/app/_providers/ForkProviders.replace.tsx
import type { ForkProvidersProps } from "./ForkProviders.default";
import { ThemeProvider } from "@/features/myTheme/components/ThemeProvider";

export function ForkProviders({ children }: ForkProvidersProps) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
```

## テスト

`pnpm test src/app/_providers/ForkProviders.test.tsx`(スイッチが既定を指す 1 行であること、既定が children を素通しすること)
