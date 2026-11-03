# scripts/codemods

上流の変更に合わせて fork のコードを機械的に書き換える道具。各道具は fork のリポのルートで走らせ、何度走らせても同じ結果になる。テスト: `pnpm test:codemods`。

| 道具 | すること |
|---|---|
| `fork-name-markers.mjs` | 受け口のファイル名から fork の名前の印を外す(共有の棚の印の移行。下) |
| `crud-entry-split.mjs` | ボタンの import を `@/lib/crud/components` へ振り分ける |
| `domain-display-buttons.mjs` | ボタンの `domain="<名前>"` を表示用の写し `domain={<名前>Display}` へ置き換える |
| `domain-json-client-display.mjs` | client のコードの domain.json の import を写し `entities/display.ts` の `domainDisplay` へ置き換える |
| `wiring-domains-split.mjs` | `@/wiring/domains` の import を `@/wiring/domainRegistry` と `@/wiring/adminScreenParts` へ振り分ける |

## fork の名前の印を外す(fork-name-markers.mjs)

受け口のファイル名は fork の名前の印を持たない(印なしの名前・丸ごと置き換え `<名前>.replace`・一部の上書き `<対象>.override`、D136・D137)。印つきのファイル(`x.<fork の名前>.ts` のような名前)は上流の生成器と検査が止めるので、この道具で移す。

```sh
node scripts/codemods/fork-name-markers.mjs              # dry-run(既定): 変更の一覧と止めた物の一覧
node scripts/codemods/fork-name-markers.mjs --apply      # 改名(git mv)・import の書き換え・常時実行の例外の分割 → pnpm extensions:generate
#   --base <rev>    基準の版(既定 = 自分の台帳 .notices/applied/<fork_id>.md の最後の upstream:<sha>)
#   --no-generate   最後の extensions:generate を省く
#   --json          機械向けの出力
```

印 = 点つきの名前のうち `.default` / `.replace` / `.override` / `.client` / `.test` 以外の語(`src/lib/forkOwnership/dottedNames.mjs`)。自分の `fork_id` でも、親(中間 Tier)の名前でも、`fork_id` と食い違った語でも拾う。触るのは受け口の場所だけ(`x.config.ts` のような普通の点つきの名前は場所の外なので触らない):

| 場所 | 移し方 |
|---|---|
| 拡張点の受け口のフォルダの直下(ファイル・フォルダ形) | 印を外す(`mine.acme.ts` → `mine.ts`、`walletAdjust.acme/` → `walletAdjust/`) |
| `<名前>.default` の隣の `<名前>.<印>`(1 行スイッチの fork の実装) | `<名前>.replace.ts(x)`。スイッチの 1 行は import の書き換えで追従 |
| `src/app` の `_layout` / `_screen` の下 | 隣に置き換える既定(`<名前>.ts(x)` か `<名前>/index.ts(x)`)があれば `<名前>.replace`(枠の layout.tsx の 1 行も追従)、無ければ fork だけの部品として印を外す |
| `scripts/tasks`・`src/wiring` の直下 | 印を外す(`client` の中置きは残す: `X.client.acme.tsx` → `X.client.tsx`) |
| `scripts/proxies/alwaysOnExceptions.<印>.mjs` | 行ごとに `scripts/proxies/alwaysOnExceptions/<名前>.mjs`(`export const exception` か `registry`)へ分ける。行のパスも改名に追従 |
| `src/**/extensionPoints.<印>.ts` | 止める(機械では移せない。fork 自身のフォルダの `extensionPoints.ts` へ点と受け口のフォルダを移す) |

- import の書き換え: `src`・`scripts` のコード(.ts / .tsx / .mts / .mjs / .js)の `@/…` と相対の指定で、改名したファイル・フォルダを指すものを新しい名前にする。JSON・Markdown の中のパスの字面は書き換えない
- 衝突(止める): 印を外した名前の単位(拡張子と末尾の `/index` を除いた名前)が、基準の版のファイル・ほかの HEAD のファイル・ほかの移行先と同じ。書き換えず、改名の案(項目 = `<名前><印の Pascal>`、タスク = `<名前>-<印>`)を出す。案は決まった規則で作るので、中間 Tier と下の Tier で同じ名前になる

### fork の手順

1. 上流のこの版(印をやめた版)を `/flux` で取り込む(上流の生成器・検査が新しくなる。生成器は印つきの名前で止まる)
2. dry-run: `node scripts/codemods/fork-name-markers.mjs` で変更の一覧と止めた物の一覧を見る
3. 止めた物を片付ける: 衝突は案(か別の名前)に手で改名し、改名した名前を使う import も直す。`extensionPoints.<印>.ts` は fork 自身のフォルダへ移す
4. `--apply`: 改名・import・常時実行の例外の分割をして、`pnpm extensions:generate` が一覧と受け口の一覧(`intake.txt` の生成区画)を作り直す
5. `pnpm extensions:check`・`pnpm test:screens`・`pnpm test:wiring`・`pnpm tsc --noEmit` を通してコミットし、`pnpm ownership:check`(上流と同じ単位名は unit-clash、自分の項目への override は override-own)
6. 多段の Tier: **中間 Tier が先に移してから**下の Tier が取り込む。下の Tier が受け継いだ中間 Tier の印つきのファイルは、中間 Tier の移行と同じ名前になるので、中間 Tier の版を取り込めば改名が揃う(下の Tier が自分で足した印つきのファイルは、取り込みの後にこの道具で移す)

確かめ(使い捨ての写し、2026-11-03): oripa-do 印つき 90 → 変更 87(フォルダ 1 件 = 4 ファイル)・止め 0、boardgame-site 26 → 変更 25・止め 1(`README.bodolist.md` が上流の `README.md` と同じ単位)、pandora(oripa-do の下)80 → 変更 77・止め 0(oripa-do から受け継いだ 67 件は oripa-do の移行と同じ名前)。`--apply` の後、上流の走査(生成器の旧い印・スイッチ・tasks・wiring・screens の点つきの名前)は旧い印 0。
