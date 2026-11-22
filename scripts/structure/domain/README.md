# ドメイン生成 CLI（pnpm generate domain）

## Overview

- 手で書いた `src/domains/<domain>/domain.json` から、ドメイン一式（entities / services / hooks / 管理画面 / レジストリ登録）を生成する CLI のリファレンスです。
- `domain.json` のスキーマ（キー・型・リレーション・`generate` 等）は [`src/domains/README.md`](../../../src/domains/README.md) が正です。
- 普段はこれを直接打たず、`pnpm forge`（[`scripts/structure/forge/README.md`](../forge/README.md)。検査 → ロールとドメインの生成 → ルートの地図 → 事後検査）で回す。
- 対象: `domain.json` を持つドメインのフォルダ。business = `src/domains/<domain>/`、core = `src/domains/core/<domain>/`。違いはフォルダだけで、生成・検査・`generate` の旗は同じ扱い（同じ名前が両方にあれば止まる）。`domain.json` の無い core は対象外（手で保守）
- core の生成の違い:
  - 生成物は `@/domains/<domain>/...` で import するので、`tsconfig.json` の `paths` に `"@/domains/<domain>/*": ["./src/domains/core/<domain>/*"]` が要る（無ければ何も書かずに止まり、足す 1 行を出す）
  - `src/registry/` の一覧は core も business も `pnpm generate registry` が走査で作る（生成器は serviceRegistry 以外を書かない）
  - 手で管理の core のファイル用途は `src/domains/core/storageObject/purposes/` に手で。`domainEntry.ts` は書くので `serviceRegistry.ts` には載る（core の手書きの domainEntry.ts と同じ経路）
- 今ある core の `domain.json` は `generate: false`（手で管理。生成器は何も書かない）
- `domain.json` は手で書く（対話で組み立てる入口は無い）。書き方の規則は生成前の検査（`checks/`）が止める・警告する
- 生成元テンプレート: `src/domains/_template/`（ドメイン側）、`src/app/admin/_template/`（管理画面ルート）
- 実行はリポジトリのルートで行う
- 長さのため分けた文書: `API.md`(生成されるもの・上書きの扱い・出力の種類のデータ)、`Internals.md`(生成の流れ・主と従属の組・生成器の構造・前後比較)

## Usage

### 典型的な流れ

新規ドメイン・項目の追加:

1. `src/domains/<camelCase>/domain.json` を手で書く・直す（スキーマと例: [src/domains/README.md](../../../src/domains/README.md)。`src/domains/sample/domain.json` が全機能の例）
2. `pnpm forge`（検査で止まったら文のとおりに直してもう一度）
3. `git status` / `git diff` で生成物を確認
4. 表が変わったら forge の最後の案内どおり `pnpm db:push`（人が実行）→ `pnpm db:push:check` で差分ゼロ

テンプレート（`_template/`）や生成器を変えたとき: `pnpm generate domain` で全ドメインへ反映し、差分を確認してサンプルの再生成結果も一緒にコミットする（`pnpm check domain -- --parity <ref>` で前後比較）。

### コマンド

| コマンド | 実体 | 用途 |
|---|---|---|
| `pnpm generate domain -- <Domain>` | `index.mjs --generate` | 1 ドメイン（と主・従属の組の全員）を生成・再生成する |
| `pnpm generate domain` | `index.mjs --generate --all` | 全ドメインを一括で再生成する |
| `pnpm generate domain -- --delete <Domain> --confirm <snake_name>` | `index.mjs --delete` | 生成物とレジストリ登録を削除する |
| `pnpm check domain -- --parity <git-ref>` | `tests/parity.mjs` | 生成器の前後比較（Internals.md「前後比較」） |
| `pnpm check domain -- --compare [<Domain>...] [--base <ref>] [--detail] [--json <file>]` | `compare.mjs` | fork が generate を true / false に決めるための比較（下の「generate の旗を決める」）。読むだけ |

オプション:

- `-i` / `--interactive`: 対話（生成方法・カテゴリ・ドメインの選択、上書きと削除の確認）。**既定は対話なし**。エージェント・CI・notice の手順では使わない
- `--only <categories>`: 今回はこのカテゴリだけ生成する（下の「カテゴリの名指し」）
- `--dry-run`: 何も書かずに、書くはずのファイルと動作を一覧する（下の「書かずに確かめる」）
- `--yes`: 受け付けて無視する（以前の「対話なし」の旗。古い手順がそのまま動く）

> **`--` は任意**: `pnpm generate domain -- -- Sample` の単独の `--` はスクリプト側（`cli/args.mjs`）が捨てる。
> `<Domain>` は snake_case / camelCase / PascalCase のどれでもよい（内部で正規化し、`src/domains/<camelCase>/` を見る）。省くと終了コード 1（選んで生成するなら `-i`）。
> 失敗（`domain.json` が無い、検査で止まる、テンプレートが無い、登録表が作れないなど）は終了コード 1 になり、**何も書かない**（生成物は全部組み立て、書いた後の状態で `serviceRegistry.ts` が作れることまで確かめてから書く）。
> **フォルダ名 = `singular` の camelCase**（例: `name_pool_entry` → `src/domains/namePoolEntry/`）が全ジェネレーターの前提。ずれているドメインがあると何も書かずに止まる（`checks/domainFolder.mjs`、`:all` は全件を事前検査）。直すときはフォルダを改名する（`singular` を変えるとテーブル名・FK 名が変わる）。

### カテゴリの名指し（`--only`）

`pnpm generate domain -- <Domain> --only registry` / `pnpm generate domain -- --only registry,hooks` のように、今回はこのカテゴリだけ生成する（保存しない）。

- `generate: true` のドメインは全カテゴリのうち名指しのものだけ。`generate: false` のドメインは名指ししても何も書かない（下の Extension「generate の旗」）。集まりの従属は従属のカテゴリの内だけ
- 作成済みの write-once（`<domain>Service.ts`・管理画面の `page.tsx`）をわざと作り直すときは、そのファイルを消してから生成する
- 不明なカテゴリ名は終了コード 1
- `--only registry` が書くのは `services/server/` の `domainEntry.ts`・`collections.ts`・`storagePurposes.ts`（ドメイン内）。最後に `serviceRegistry.ts` を丸ごと作り直す（`:all` は全ドメインの domainEntry.ts を書いた後に 1 回だけ）。他の `src/registry/` の一覧は `pnpm generate registry`（forge の段）
  - storagePurposes.ts には、画像を含むメディア項目の `metadata`（`storage.metadata`、省略 = `"strip"`）が明示値で入る。`storage.image`（画像の縮小の指定）は書いたときだけ入る（形・keep の項目への指定は生成エラー）。strip の項目の accept にサーバーで描き直せない画像の型（`image/heic` など）があると生成エラー（直し方: [src/domains/README.md](../../../src/domains/README.md)「ファイルの保存（storage）」）
  - private の用途の `read.allow` は `storage.read`（`"public"` も可）、無ければ apiAccess の get の規則。visibility を省いた項目の公開・非公開の導出も同じ規則を使う
- `.notices` で再生成が要るときは、必要なカテゴリだけを `--only` で指定する（例: レジストリの書き換え → `pnpm generate domain -- --only registry`）。`[user-run]` は付けない

### 書かずに確かめる（`--dry-run`）

`pnpm generate domain -- <Domain> --dry-run` / `pnpm generate domain -- --dry-run --only registry` のように付けると、何も書かずに、書くはずのファイルごとの動作を一覧する。

- 動作: `作成` / `上書き`（内容が変わる）/ `変更なし` / `保持`（write-once で既存を残す）/ `移行`（旧形式の page.tsx を 1 行スイッチへ）/ `スキップ`（レジストリのファイルが無い）。最後に `[dry-run] <domain>: 作成 N / 上書き N / ...` のまとめ
- `serviceRegistry.ts` の作り直しは実行時に行うので一覧には出ない（まとめに注記が付く）
- forge の事前検査はこれ（`pnpm generate domain -- --dry-run`）で domain.json の検査を回す

### `pnpm generate domain -- --delete <Domain> --confirm <snake_name>`

0. 主と従属の組を壊す削除と、他のドメインから参照されているドメインの削除と、残るコードから import されているドメインの削除は、エラーで止まり何も消さない（`pipeline/remove/deleteStop.mjs`。`--force` は無い。他のドメインの domain.json は書き換えない）
   - 主: domain.json が残っている従属があれば止まる。消す順 = 主の集まりの項目を外す → 従属を `pnpm generate domain -- --delete --remove-config` → 主を `pnpm generate domain -- --delete`
   - 従属: 主が集まりの項目を宣言している間は止まる（残すと次の生成で雛形がまた書き出される）。先に主の項目を外す
   - 参照: 他のドメインの domain.json の `relations` が belongsTo / belongsToMany（`includeRelationTable: false` の逆側を含む）/ hasMany / hasOne で指していれば止まり、参照元のドメインと fieldName を全部出す。先に参照元の関連を外すか、参照元を `--remove-config` 付きで消す
   - 判定は domain.json の宣言だけを見る: domain.json を残した削除（既定）の参照元は宣言が残るので止まり続ける。自己参照と、消すドメイン自身が持つ関連は数えない。domain.json の無いドメイン・読めない domain.json は見えない
   - import: `src` 配下の消さずに残るコード（`.ts` / `.tsx` / `.mts` / `.mjs` など）が消すドメインのフォルダを import していれば止まり、参照元のファイルと from 先を全部出す（`codeReferences`、純関数）。`@/domains/<d>/…`・`@/domains/core/<d>/…`（core は `core/` を省いた書き方も）・解決するとフォルダに入る相対パス・動的 `import()`・`require()` を数える。コメントの中は数えない
     - 数えないもの: 消すフォルダの中、管理画面ルート（一緒に消す）、`--extra` で選んだディレクトリ、閉じられるドメインの門番の規則と上書き（下の 3 の後始末）、`src/registry/`（生成物。消した後に `pnpm generate registry` で作り直す）
     - 追加ディレクトリの候補の中の import は、確認（`--confirm`）の前は数えず、選ばなかった候補だけを確認の後に数えて止める
     - 外部キーを張る列（drizzle の `.references()`）は参照元が相手の表を import するので、ここで止まる
   - 見えないもの（消す前に自分で確かめる）: 外部キーを張らない素の id 列（`coupon_id` を text で持つだけの列など。宣言にもコードにも参照が出ない）、文字列でドメイン名を渡す参照（serviceRegistry・domainRegistry 経由、`/api/<domain>` の URL）、`src` の外（`servers/` など）。確かめ方: `git grep -n "<snake_name>_id\|<camelName>Id\|\"<snake_name>\"\|/api/<snake_name>" -- src servers`
1. `--confirm` がドメイン名（snake_case）と一致したときだけ消す（名前の打ち直しの安全装置を引数にしたもの）。無い・違うなら、消すものの一覧・追加で消せるディレクトリの候補・そのまま打てるコマンドを出して終了コード 1
2. `--extra <path>`（何度でも）: `src/app/` 配下で名前が一致する追加ディレクトリのうち、候補に出たものだけ受け付ける
3. `--remove-config`: `domain.json` も消す（既定は `domain.json` だけ残してドメインディレクトリの中身を消す）
   - 門番の規則(`src/featureGate/rules/<名前>.ts`)の `domains` がこのドメインのフォルダを持てば、何も消さずに規則の名前を出して止める(終了コード 1)。規則の `domains` から外す(規則ごと要らなければ規則を消す)→ `pnpm generate extensions` → もう一度削除
4. `-i` のときは今までの対話（名前の再入力 → 追加ディレクトリの選択 → domain.json を消すか → 確認）

削除するもの: `src/domains/<domain>/`（`domainEntry.ts` ごと）、`src/app/admin/(protected)/<domains>/`（`_components/` 含むルートごと）、選んだ追加ディレクトリ。レジストリからは `adminDomains.ts` / `schemaRegistry.ts` / `domainConfigRegistry.ts` の該当行を消し、`serviceRegistry.ts` は残った domainEntry.ts から `pnpm generate registry` で作り直し、地区の地図 `district-map.jsonl` を書き直す。DB のテーブルは消さない。

- `domainConfigMap` のエントリは、オブジェクト直下のキーが完全一致するものだけを複数行ごと消す（`text/objectEntry.mjs` の `removeObjectEntry`）
- レジストリの更新に失敗してもディレクトリ削除は済んでいるため止めず、最後に手で直すファイルを表示して終了コード 1 で終わる

### よくある失敗

- 生成が `[<domain>] ...` の文を並べて止まる → domain.json の決まり（必須キー・項目名と従属名の snake_case・外部キーの型・enum の選択肢・既定値・メディアの accept・一覧の設定の名前・廃止した `generateFiles`）に反している。文のとおりに直す（規則の一覧: [src/domains/README.md](../../../src/domains/README.md)「API」）
- `[domain.json] <domain>: ...` の警告が出る → 綴り違いのキー、古いキー（`version` → `domainConfigVersion`、`onDeleteCascade` → `onDelete`）、その DB に無い `fieldType`、知らない `formInput`、表に無い型と入力欄の組、選択肢の要る入力欄に options が無い、など（`checks/vocabulary.mjs` と各検査の `*Warnings`）
  - 生成は止まらないが、未知の `fieldType` は列名としてそのまま出力され、未知の `formInput` はフォームに出ないので直す
  - 知らないキーは同じキーをドメインごとに 1 行（件数と最初の 3 か所）にまとめ、他の警告の後ろに並べる
  - 開発者のメモは `"$comment"`（どの階層でも通り、生成物にも写しにも出ない。`src/domains/README.md`「開発者のメモ（$comment）」）
- `domain.json` が壊れている（JSON として読めない） → 直してから再実行
- `テンプレートのトークンが置換されていません` → 管理画面テンプレートに未対応のトークンが残っている。テンプレートを直す
- `src/registry/district-map.jsonl` が `pnpm check district-map` で落ちる → `pnpm generate district-map`（または forge）で作り直してコミット

## API

- 生成されるもの(カテゴリと出力先)・上書きの扱い・出力の種類のデータ(`phase.json` の `outputs`)は `API.md`

## Extension

### generate の旗（ドメイン単位）

`domain.json` の `generate`（省略 = true）が、そのドメインを生成器が持つか手で持つかを決める。区分ごとの `generateFiles` は廃止（残っていると生成前に止まる）。

- `true`: API.md「生成されるもの」の全カテゴリを毎回作り直す（集まりの従属は entities / serverServices / registry / fieldConstants / presenters だけ。生成器が決める）。手の実装は生成物の外（`wrappers/`、write-once の `<domain>Service.ts`、`formEntities.ts`、`_components/`）に置き、再生成のたびに載せ替わる前提
- `false`: 手で管理。生成器は何も書かない（`domainEntry.ts` の書き直し・従属の domain.json も無し。`serviceRegistry.ts` は `domainEntry.ts` から作るので載り続ける）。載せ替えが手間になったドメインをこちらにする
- `domainEntry.ts` を持たないまま `false` にしたドメイン（旧 `generateFiles.registry: false` から移ったものなど）は登録表に載らず `pnpm check registry` が止まる → `domainEntry.ts` を手書きする（写せる形: [src/lib/domain/README.md](../../../src/lib/domain/README.md)「generate: false の業務ドメイン」）
- `false` のドメインはどんな実行でも生成器を通さない: `pnpm generate domain`・forge・1 ドメインの名指し・`--only`・`-i` のどれでも何も書かず、生成前の検査もしない（`[<domain>] generate: false（手で管理）のため何も書きません` の 1 行だけ）。一度だけ作り直すときは `generate` を true に戻して生成し、要る手書きを戻してから false に戻す
- `false` に切り替えたら `pnpm generate domain -- --unmark <Domain>`(名を省くと generate: false の全部)で、そのドメインのフォルダと管理画面のルートのファイルから生成物の印の行を外す。印が残っていると手で直すファイルを「直さない」と読み違えるので、`pnpm check rules` が止める
- 一覧: 生成の書き込みの最後と `pnpm generate domain -- --delete` の後に地区の地図 `src/registry/district-map.jsonl` を書き直す(features の行の `domainJson` = domain.json の有無・`generate` = 旗、無ければ null。中身: `src/lib/districtMap/README.md`)。ずれは `pnpm check district-map` が落とす。merge で衝突したら `pnpm generate district-map` で作り直す

#### generate の旗を決める（`pnpm check domain -- --compare`）

fork が各ドメインを生成に任せる（true）か手で管理する（false）かを、ファイルごとの証拠で決める道具。fork のリポのルートで回す（何も書かない。写しは一時ディレクトリ）。

- 比べる 3 つ: 今のファイル ／ base（`upstream` の remote との merge-base、無ければ `--base <ref>`）の生成器の出力 ／ 今の生成器の出力。どちらの生成器も domain.json を「全部生成する」形にした写しで、ドメインを 1 つずつ回す（古い `generateFiles` の domain.json もそのまま読む）。生成器が扱うファイルは `--dry-run` の一覧で決める。base 側は base のテンプレートと src の部品も使う（`cli/compare/refGenerator.mjs`。pnpm test scripts/structure/domain/tests の旧側と同じ）
- 欄: 未改変（base の出力と同じ。今の出力と違えば「上流の改良で変わる」）/ 手の変更の見込み（base の出力に行を挿した）/ 古い生成物の見込み（消した・置き換えただけ = base より前の生成器の出力のまま）/ 新しく作られる（管理画面の page.tsx・`_screen/`・`domainEntry.ts` は「新しい入口」）/ 残る（write-once）/ fork のファイル（生成器が作らない。wrappers/ は別に数える）/ 表の定義の書き直し（entities/drizzle.ts が変わる → `db:push:check` 0 を確かめる）
- 見込み: `true にできる`（全部未改変）/ `確かめて true`（新しい入口・表の書き直し・古い生成物の見込みがある）/ `wrappers へ移すか false`（手の変更の見込みがある）/ `直してから`（今の生成器で止まる。理由を出す）
- 手の変更と古い生成物は中身だけでは区別できない（挿した行 = 手の変更、と見なす）。`--detail` のファイルごとの行数と「最後の commit」の題で確かめてから決める
- 決め方: 上の欄と見込みを `--detail` で確かめて決める。決めた理由は domain.json ではなく移行の commit の本文に書く（記録は generate の旗だけ）

### 生成物を変えたいとき（生成ファイルは編集しない）

- **項目・選択肢・表示列など** → `domain.json` を直して `pnpm forge`
- **フォームに独自項目・差し込み UI** → 生成された `<Domain>Form` / `<Domain>Fields` は FieldRenderer の props（`fieldPatches` / `insertBefore` / `insertAfter` / `fieldGroups` / `beforeField` 等）を受け取る。fork 所有の `_components/` から渡す（[`src/lib/formSuite/FieldRenderer/README.md`](../../../src/lib/formSuite/FieldRenderer/README.md)）
- **管理画面のレイアウト** → `_screen/` を同じルートの `_components/` にコピーして `page.tsx` を向ける
- **CRUD の振る舞い** → `services/server/wrappers/` に置き、write-once の `<domain>Service.ts` で組み込む
- **一覧の一括操作** → 生成された受け口 `adminBulkActions/` に項目を 1 ファイルずつ置いて `pnpm generate extensions`（`Table.tsx` には書かない。書き方: [`src/lib/tableSuite/README.md`](../../../src/lib/tableSuite/README.md)「一括操作の受け口」）。項目が無ければ一覧は選択の無い素の表
- 生成ファイルを手で直す必要が出た・載せ替えが手間になった → そのドメインを `"generate": false` にする（以後は生成器が何も書かない。`--only` で名指ししても書かない）

## Internals

- 生成の流れ・主と従属の組・生成器の構造(直す人向け)・前後比較は `Internals.md`
