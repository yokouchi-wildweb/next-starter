# src/lib/business — 事業の素性

サービス名・説明・公式の URL・運営会社・ロゴ・メールの既定の差出人・サイトの言語(`htmlLang`)・SEO と OGP の既定(`seo`)など、プロジェクトの素性(リリースまでに必ず自分の値にする物)の型・例の値・受付係の判定・本番の検査を持つ閉じた lib です(設定の議会 D20・D66・D88)。法務の文書だけが読む値(決済方法の表示・規約とポリシーの日付・許認可)はここに入れず legal へ移します(移すまでは古い `src/config/business.config.ts` の殻にあります)。

## 置き場と読み方

| 物 | 置き場 | 持ち主 |
|---|---|---|
| このプロジェクトの値と印 | `src/business/business.ts` | fork(フォルダごと fork の物、受け口 `edit src/business/**`) |
| 型・例の値・判定・本番の検査 | `src/lib/business/`(この lib) | 上流 |
| 例の値 | `src/lib/business/examples/business.ts`(変更履歴 `examples/CHANGELOG.md`) | 上流(fork は編集しない) |
| 受付係(結び) | `src/wiring/business.ts`。tsconfig.json の `"@/business"` がここを指す | 上流 |

- 読み手(features・app の枠・route・scripts・fork のコード)は `import { business } from "@/business"` だけを読む。scripts は `@/wiring` と同じく `await import("@/business")`(lint scripts-no-static-wiring)
- lib と utils は `@/business` を読まず、値を引数で受ける(例 `logoPath(business.logo, "dark")`)。lib/mail・lib/url・lib/metadata は今は殻を読み、lib を閉じるときに自分の設定の上書きが `@/business` から写す(上書きファイルが `@/business` を読むのは lint `config-overrides/literal-only` の例外)
- SEO のサイト名・URL・説明は `serviceNameShort`・`url`・`description` から作る(別の鍵を持たない)。viewport は事業の素性でなく root の枠の設定(`src/app/_layout/config.ts`)
- `resolveBusiness(file, examples?)` の 2 つ目で例の値を差し替えられる(この lib を他のプロジェクトに組み込むとき)
- 公式の URL(`business.url`)はメール・SEO 用。実行時の origin は `@/lib/url` の `getAppBaseUrl()`(Host ヘッダーから作らない)

## 印 `source`

```ts
// src/business/business.ts
import type { BusinessFile } from "@/lib/business";

export default { source: "sample" } satisfies BusinessFile; // 上流の出荷の状態: @/business は例の値を返す
// export default { source: "own", values: { serviceName: "…", … } } satisfies BusinessFile; // 自分の値(全部の欄が必須)
```

- `sample` = `@/business` は例の値を返す。本番(`@/lib/appEnv` の `isProduction`、APP_ENV が無いときも本番)でビルドすると門 build の `pnpm check business` が止める。Tier1(fork_id = next-starter、上流のデモ)だけ警告
- `own` = `values` の全部の欄が必須(書き忘れは `pnpm typecheck` で落ちる)

## 初期化の道具

- `pnpm ops business from-example` — 例の値を写して own にする(値はその後に書き換える)
- `pnpm ops business blank` — own にして全部の欄を空にする(ロゴの既定の種類だけ名前のまま)
- どちらも既に own なら `--force` が無い限り書かない。書くのは手元の `src/business/business.ts` だけ

## テスト

`pnpm test src/lib/business`(判定と本番の検査)・`pnpm test scripts/operations/business`(初期化の道具)。門: `scripts/structure/business/`
