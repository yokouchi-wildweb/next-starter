# src/lib/business — 事業の素性

## Overview

- サービス名・説明・公式の URL・運営会社・ロゴ・メールの既定の差出人・サイトの言語(`htmlLang`)・SEO と OGP の既定(`seo`)など、プロジェクトの素性(リリースまでに必ず自分の値にする物)の型・例の値・受付係の判定・本番の検査を持つ閉じた lib
- 使う時・直す時の決まりは札 .claude/rules/items/lib/business.md にある。この README は使い方と仕組み

## Usage

置き場と持ち主:

| 物 | 置き場 | 持ち主 |
|---|---|---|
| このプロジェクトの値と印 | `src/business/business.ts` | fork(フォルダごと fork の物、受け口 `edit src/business/**`) |
| 型・例の値・判定・本番の検査 | `src/lib/business/`(この lib) | 上流 |
| 例の値 | `src/lib/business/examples/business.ts`(変更履歴 `examples/CHANGELOG.md`) | 上流 |
| 受付係(結び) | `src/wiring/business.ts`。tsconfig.json の `"@/business"` がここを指す | 上流 |

```ts
import { business } from "@/business";

logoPath(business.logo, "dark"); // lib や utils には値を引数で渡す
```

- scripts は `@/wiring` と同じく `await import("@/business")`(lint scripts-no-static-wiring)
- lib/mail・lib/metadata・lib/url の設定の上書き(`src/config/lib/<名前>.config.ts`)が `@/business` を読むのは lint `config-overrides/literal-only` の例外
- 公式の URL(`business.url`)はメール・SEO 用。実行時の origin は `@/lib/url` の `getAppBaseUrl()`

## API

- `resolveBusiness(file, examples?)`: 印に従って値を返す。2 つ目で例の値を差し替えられる(この lib を他のプロジェクトに組み込むとき)
- `sampleReleaseLevel({ hasSample, production, tier1 })`: sample が無いか本番でなければ ok、あれば error、Tier1 は warn。法務の文書の検査(`src/domains/core/legal` の `checkLegalRelease`、`pnpm check legal`)も使う
- 型 `BusinessFile`(`@/lib/business`)

## Extension

印 `source`:

```ts
// src/business/business.ts
import type { BusinessFile } from "@/lib/business";

export default { source: "sample" } satisfies BusinessFile; // 上流の出荷の状態: @/business は例の値を返す
// export default { source: "own", values: { serviceName: "…", … } } satisfies BusinessFile; // 自分の値(全部の欄が必須)
```

- `sample` = `@/business` は例の値を返す
- `own` = `values` の全部の欄が必須(書き忘れは `pnpm typecheck` で落ちる)

初期化の道具:

- `pnpm ops business from-example` — 例の値を写して own にする(値はその後に書き換える)
- `pnpm ops business blank` — own にして全部の欄を空にする(ロゴの既定の種類だけ名前のまま)
- どちらも既に own なら `--force` が無い限り書かない。書くのは手元の `src/business/business.ts` だけ

## Internals

- 本番の検査 `pnpm check business`(段階 build): sample のまま本番(`@/lib/appEnv` の `isProduction`、APP_ENV が無いときも本番)でビルドすると止める。Tier1(`repo.json` の `repo_id` = next-starter、上流のデモ)だけ警告。門の実体は `scripts/structure/business/`

## Verification

- `pnpm test src/lib/business`(判定と本番の検査)
- `pnpm test scripts/operations/business`(初期化の道具)
