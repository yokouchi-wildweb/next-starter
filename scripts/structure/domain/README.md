# ドメイン生成 CLI（dc:*）

> 手で書いた `src/features/<domain>/domain.json` から、ドメイン一式（entities / services / hooks / 管理画面 / レジストリ登録）を生成する CLI のリファレンスです。
> `domain.json` のスキーマ（キー・型・リレーション・`generate` 等）は [`src/features/README.md`](../../../src/features/README.md) が正です。
> 普段はこれを直接打たず、`pnpm forge`（[`scripts/structure/forge/README.md`](../forge/README.md)。検査 → ロールとドメインの生成 → ルートの地図 → 事後検査）で回す。

- 対象: `domain.json` を持つドメインのフォルダ。business = `src/features/<domain>/`、core = `src/features/core/<domain>/`。違いはフォルダだけで、生成・検査・`generate` の旗は同じ扱い（同じ名前が両方にあれば止まる）。`domain.json` の無い core は対象外（手で保守）
- core の生成の違い: 生成物は `@/features/<domain>/...` で import するので、`tsconfig.json` の `paths` に `"@/features/<domain>/*": ["./src/features/core/<domain>/*"]` が要る（無ければ何も書かずに止まり、足す 1 行を出す）。`src/registry/` の一覧は core も business も `pnpm generate registry` が走査で作る（生成器は serviceRegistry 以外を書かない）。手で管理の core のファイル用途は `src/features/core/storageObject/purposes/` に手で。`domainEntry.ts` は書くので `serviceRegistry.ts` には載る（core の手書きの domainEntry.ts と同じ経路）
- 今ある core の `domain.json` は `generate: false`（手で管理。生成器は何も書かない）
- `domain.json` は手で書く（対話で組み立てる入口は無い）。書き方の規則は生成前の検査（`checks/`）が止める・警告する
- 生成元テンプレート: `src/features/_template/`（ドメイン側）、`src/app/admin/_template/`（管理画面ルート）
- 実行はリポジトリのルートで行う

---

## コマンド

| コマンド | 実体 | 用途 |
|---|---|---|
| `pnpm generate domain -- <Domain>` | `index.mjs --generate` | 1 ドメイン（と主・従属の組の全員）を生成・再生成する |
| `pnpm generate domain` | `index.mjs --generate --all` | 全ドメインを一括で再生成する |
| `pnpm generate domain -- --delete <Domain> --confirm <snake_name>` | `index.mjs --delete` | 生成物とレジストリ登録を削除する |
| `pnpm generate domain -- --feature-map [--check]` | `feature-map.mjs` | ドメインの一覧 `src/features/feature-map.txt` を書き出す / 照らす |
| `pnpm test scripts/structure/domain/tests <git-ref>` | `tests/parity.mjs` | 生成器の前後比較（下の「前後比較」） |
| `pnpm check domain -- --compare [<Domain>...] [--base <ref>] [--detail] [--json <file>]` | `compare.mjs` | fork が generate を true / false に決めるための比較（下の「generate の旗を決める」）。読むだけ |

オプション:

- `-i` / `--interactive`: 対話（生成方法・カテゴリ・ドメインの選択、上書きと削除の確認）。**既定は対話なし**。エージェント・CI・notice の手順では使わない
- `--only <categories>`: 今回はこのカテゴリだけ生成する（下の「カテゴリの名指し」）
- `--dry-run`: 何も書かずに、書くはずのファイルと動作を一覧する（下の「書かずに確かめる」）
- `--yes`: 受け付けて無視する（以前の「対話なし」の旗。古い手順がそのまま動く）

> **`--` は任意**: `pnpm generate domain -- -- Sample` の単独の `--` はスクリプト側（`cli/args.mjs`）が捨てる。
> `<Domain>` は snake_case / camelCase / PascalCase のどれでもよい（内部で正規化し、`src/features/<camelCase>/` を見る）。省くと終了コード 1（選んで生成するなら `-i`）。
> 失敗（`domain.json` が無い、検査で止まる、テンプレートが無い、登録表が作れないなど）は終了コード 1 になり、**何も書かない**（生成物は全部組み立て、書いた後の状態で `serviceRegistry.ts` が作れることまで確かめてから書く）。
> **フォルダ名 = `singular` の camelCase**（例: `name_pool_entry` → `src/features/namePoolEntry/`）が全ジェネレーターの前提。ずれているドメインがあると何も書かずに止まる（`checks/domainFolder.mjs`、`:all` は全件を事前検査）。直すときはフォルダを改名する（`singular` を変えるとテーブル名・FK 名が変わる）。

## generate の旗（ドメイン単位）

`domain.json` の `generate`（省略 = true）が、そのドメインを生成器が持つか手で持つかを決める。区分ごとの `generateFiles` は廃止（残っていると生成前に止まる）。

- `true`: 下の「生成されるもの」の全カテゴリを毎回作り直す（集まりの従属は entities / serverServices / registry / fieldConstants / presenters だけ。生成器が決める）。手の実装は生成物の外（`wrappers/`、write-once の `<domain>Service.ts`、`formEntities.ts`、`_components/`）に置き、再生成のたびに載せ替わる前提
- `false`: 手で管理。生成器は何も書かない（`domainEntry.ts` の書き直し・従属の domain.json も無し。`serviceRegistry.ts` は `domainEntry.ts` から作るので載り続ける）。載せ替えが手間になったドメインをこちらにする
- `domainEntry.ts` を持たないまま `false` にしたドメイン（旧 `generateFiles.registry: false` から移ったものなど）は登録表に載らず `pnpm check registry` が止まる → `domainEntry.ts` を手書きする（写せる形: [src/lib/domain/README.md](../../../src/lib/domain/README.md)「generate: false の業務ドメイン」）
- `false` のドメインはどんな実行でも生成器を通さない: `pnpm generate domain`・forge・1 ドメインの名指し・`--only`・`-i` のどれでも何も書かず、生成前の検査もしない（`[<domain>] generate: false（手で管理）のため何も書きません` の 1 行だけ）。一度だけ作り直すときは `generate` を true に戻して生成し、要る手書きを戻してから false に戻す
- 一覧: 生成の書き込みの最後と `pnpm generate domain -- --delete` の後に `src/features/feature-map.txt`（`src/features` と `src/features/core` の全フォルダ。`_` 始まりを除く。kind / domain.json の有無 / generate）を書き直す。`pnpm check domain` がフォルダの増減・旗の切り替えのずれで落ちる。merge で衝突したら `pnpm generate domain -- --feature-map` で作り直す

### generate の旗を決める（`pnpm check domain -- --compare`）

fork が各ドメインを生成に任せる（true）か手で管理する（false）かを、ファイルごとの証拠で決める道具。fork のリポのルートで回す（何も書かない。写しは一時ディレクトリ）。

- 比べる 3 つ: 今のファイル ／ base（`upstream` の remote との merge-base、無ければ `--base <ref>`）の生成器の出力 ／ 今の生成器の出力。どちらの生成器も domain.json を「全部生成する」形にした写しで、ドメインを 1 つずつ回す（古い `generateFiles` の domain.json もそのまま読む）。生成器が扱うファイルは `--dry-run` の一覧で決める。base 側は base のテンプレートと src の部品も使う（`cli/compare/refGenerator.mjs`。pnpm test scripts/structure/domain/tests の旧側と同じ）
- 欄: 未改変（base の出力と同じ。今の出力と違えば「上流の改良で変わる」）/ 手の変更の見込み（base の出力に行を挿した）/ 古い生成物の見込み（消した・置き換えただけ = base より前の生成器の出力のまま）/ 新しく作られる（管理画面の page.tsx・`_screen/`・`domainEntry.ts` は「新しい入口」）/ 残る（write-once）/ fork のファイル（生成器が作らない。wrappers/ は別に数える）/ 表の定義の書き直し（entities/drizzle.ts が変わる → `db:push:check` 0 を確かめる）
- 見込み: `true にできる`（全部未改変）/ `確かめて true`（新しい入口・表の書き直し・古い生成物の見込みがある）/ `wrappers へ移すか false`（手の変更の見込みがある）/ `直してから`（今の生成器で止まる。理由を出す）
- 手の変更と古い生成物は中身だけでは区別できない（挿した行 = 手の変更、と見なす）。`--detail` のファイルごとの行数と「最後の commit」の題で確かめてから決める
- 決め方の手順は notice 20261030-150956-generate-decision-compare。決めた理由は domain.json ではなく移行の commit の本文に書く（記録は generate の旗だけ）

## カテゴリの名指し（`--only`）

`pnpm generate domain -- <Domain> --only registry` / `pnpm generate domain -- --only registry,hooks` のように、今回はこのカテゴリだけ生成する（保存しない）。

- `generate: true` のドメインは全カテゴリのうち名指しのものだけ。`generate: false` のドメインは名指ししても何も書かない（上の「generate の旗」）。集まりの従属は従属のカテゴリの内だけ
- 作成済みの write-once（`<domain>Service.ts`・管理画面の `page.tsx`）をわざと作り直すときは、そのファイルを消してから生成する
- 不明なカテゴリ名は終了コード 1
- `--only registry` が書くのは `services/server/` の `domainEntry.ts`・`collections.ts`・`storagePurposes.ts`（ドメイン内）。最後に `serviceRegistry.ts` を丸ごと作り直す（`:all` は全ドメインの domainEntry.ts を書いた後に 1 回だけ）。他の `src/registry/` の一覧は `pnpm generate registry`（forge の段）
  - storagePurposes.ts には、画像を含むメディア項目の `metadata`（`storage.metadata`、省略 = `"strip"`）が明示値で入る。strip の項目の accept にサーバーで描き直せない画像の型（`image/heic` など）があると生成エラー（直し方: [src/features/README.md](../../../src/features/README.md)「ファイルの保存（storage）」）
  - private の用途の `read.allow` は `storage.read`（`"public"` も可）、無ければ apiAccess の get の規則。visibility を省いた項目の公開・非公開の導出も同じ規則を使う
- `.notices` で再生成が要るときは、必要なカテゴリだけを `--only` で指定する（例: レジストリの書き換え → `pnpm generate domain -- --only registry`）。`[user-run]` は付けない

## 書かずに確かめる（`--dry-run`）

`pnpm generate domain -- <Domain> --dry-run` / `pnpm generate domain -- --dry-run --only registry` のように付けると、何も書かずに、書くはずのファイルごとの動作を一覧する。

- 動作: `作成` / `上書き`（内容が変わる）/ `変更なし` / `保持`（write-once で既存を残す）/ `移行`（旧形式の page.tsx を 1 行スイッチへ）/ `スキップ`（レジストリのファイルが無い）。最後に `[dry-run] <domain>: 作成 N / 上書き N / ...` のまとめ
- `serviceRegistry.ts` の作り直しは実行時に行うので一覧には出ない（まとめに注記が付く）
- forge の事前検査はこれ（`pnpm generate domain -- --dry-run`）で domain.json の検査を回す

---

## 生成の流れ（`pipeline/generate.mjs`）

読む → 検査（`checks/`、全件を並べて止める）→ 全カテゴリの生成物を組み立てる（主の集まりの項目 `mediaCollection` があれば、従属の domain.json を無いときだけ書き出す Output も足す。`render/collections/`。雛形の形と権限の写し: [src/features/README.md](../../../src/features/README.md)「主の集まりの項目（mediaCollection）」）→ 書いた後の状態で `serviceRegistry.ts` が作れるか確かめる → 書く → `serviceRegistry.ts` を作り直す → feature-map を書き直す。登録表が作れない状態（手書きの行が残っている、他のドメインに `domainEntry.ts` が無い）なら何も書かずに止まる。

`pnpm generate domain` は全ドメインの生成物を先に組み立て、登録表が作れることを確かめてから書き始めるので、途中のドメインで止まって半端に残ることはない。テンプレートを変えたあとの一括反映に使う。

### 主と従属の組（`pipeline/pairs.mjs`）

生成の前に全 domain.json から「集まりの項目 → 従属、従属 → 所有する主」を一度だけ解く。主・従属のどちらを指定しても組の全員を「従属 → 主」の順に生成する（この実行で書き出す従属は、書き出す中身でそのまま生成する）。組の他の員のカテゴリは自分の `generate`（`--only` で絞る）。`:all` では選んだドメインの組の全員を加え、従属を所有する主の直前に並べる。

組の誤りは何も書く前に全件を並べて止まる。1 ドメインの生成では、指定したドメインの組に関わる誤りだけを見る。道具は domain.json を書き換えず、直す場所を出す。組を解く段が見るもの: 集まりの項目に `collection.domain` が無い・1 つの従属を 2 つ以上の主が宣言。組ごとの検査（`checks/pairs.mjs`）:

- 主の集まりの項目にファイルの条件（slug・accept・mediaTypePreset・validationRule・storage）がある（従属の `file` に書く）
- 従属の主への belongsTo が 1 本でない・required でない・onDelete が CASCADE でない / 従属が `useSoftDelete: true`
- 従属のメディア項目（mediaUploader）がちょうど 1 つでない・mediaCollection を持つ
- 並び列（主の項目が reorderable のとき）: `sortOrderField` が無い・その項目が無い・`systemColumns` に無い
- 主から埋められない必須の項目（主への参照・メディア・並び以外で required かつ defaultValue なし）
- 権限: 従属の `file` の upload が主の create・update の和より狭い / read が主の get より狭い（従属が public なら見ない）。主の規則が写せない形（none・知らない値・主が `generate: false`）なら見ない。広さは public ⊇ authenticated ⊇ ロールの規則 ⊇ none、ロールは role.json のカテゴリに解いて比べる（`checks/accessRules.mjs`）
- 63 字: 従属の表名、主への FK の短い名前も超えるとき / 名前の衝突: 従属の singular・表名が他のドメインと重なる、主の集まりの項目名が主の他の項目・関係の fieldName と重なる
- required の集まりに `collection.duplicate: false`
- 知らせるだけ（止めない）: 従属の upload が主より広い、従属の汎用 API（apiAccess）が開いている

組が関わる生成は最後に 3 行の一覧を出す: 書き出した domain.json / `db:push` が要る表（この実行で新しく書き出した従属の表だけ）/ コミットに含めるもの。`--dry-run` では「書き出す予定」として同じ一覧。

従属のドメイン名の既定（`spec/collectionField.mjs` の `defaultChildName`）: 項目名が s で終われば `<主の singular>_<項目名から末尾の s を 1 つ外したもの>`（plural = `<主の singular>_<項目名>`）、それ以外は `<主の singular>_<項目名>`（plural は推定）。例: sample + images → sample_image / sample_images。

複数形の推定（plural の無い domain.json・関係先の項目名・従属の plural）: `domain/plural.mjs` の `toPlural` 1 か所だけ。語の規則は devDependency の `pluralize` の表に任せ、名前の最後の語だけを複数形にする（例: card_set → card_sets、user_media → user_media、userPerson → userPeople）。domain.json の `plural` が常に優先。推定が誤る語は手の規則を書かず、`plural.mjs` で `pluralize.addIrregularRule` / `addUncountableRule` を足す。

## `pnpm generate domain -- --delete <Domain> --confirm <snake_name>`

0. 主と従属の組を壊す削除と、他のドメインから参照されているドメインの削除と、残るコードから import されているドメインの削除は、エラーで止まり何も消さない（`pipeline/remove/deleteStop.mjs`。`--force` は無い。他のドメインの domain.json は書き換えない）
   - 主: domain.json が残っている従属があれば止まる。消す順 = 主の集まりの項目を外す → 従属を `pnpm generate domain -- --delete --remove-config` → 主を `pnpm generate domain -- --delete`
   - 従属: 主が集まりの項目を宣言している間は止まる（残すと次の生成で雛形がまた書き出される）。先に主の項目を外す
   - 参照: 他のドメインの domain.json の `relations` が belongsTo / belongsToMany（`includeRelationTable: false` の逆側を含む）/ hasMany / hasOne で指していれば止まり、参照元のドメインと fieldName を全部出す。先に参照元の関連を外すか、参照元を `--remove-config` 付きで消す
   - 判定は domain.json の宣言だけを見る: domain.json を残した削除（既定）の参照元は宣言が残るので止まり続ける。自己参照と、消すドメイン自身が持つ関連は数えない。domain.json の無いドメイン・読めない domain.json は見えない
   - import: `src` 配下の消さずに残るコード（`.ts` / `.tsx` / `.mts` / `.mjs` など）が消すドメインのフォルダを import していれば止まり、参照元のファイルと from 先を全部出す（`codeReferences`、純関数）。`@/features/<d>/…`・`@/features/core/<d>/…`（core は `core/` を省いた書き方も）・解決するとフォルダに入る相対パス・動的 `import()`・`require()` を数える。コメントの中は数えない
     - 数えないもの: 消すフォルダの中、管理画面ルート（一緒に消す）、`--extra` で選んだディレクトリ、`src/registry/`（生成物。消した後に `pnpm generate registry` で作り直す）
     - 追加ディレクトリの候補の中の import は、確認（`--confirm`）の前は数えず、選ばなかった候補だけを確認の後に数えて止める
     - 外部キーを張る列（drizzle の `.references()`）は参照元が相手の表を import するので、ここで止まる
   - 見えないもの（消す前に自分で確かめる）: 外部キーを張らない素の id 列（`coupon_id` を text で持つだけの列など。宣言にもコードにも参照が出ない）、文字列でドメイン名を渡す参照（serviceRegistry・domainRegistry 経由、`/api/<domain>` の URL）、`src` の外（`servers/` など）。確かめ方: `git grep -n "<snake_name>_id\|<camelName>Id\|\"<snake_name>\"\|/api/<snake_name>" -- src servers`
1. `--confirm` がドメイン名（snake_case）と一致したときだけ消す（名前の打ち直しの安全装置を引数にしたもの）。無い・違うなら、消すものの一覧・追加で消せるディレクトリの候補・そのまま打てるコマンドを出して終了コード 1
2. `--extra <path>`（何度でも）: `src/app/` 配下で名前が一致する追加ディレクトリのうち、候補に出たものだけ受け付ける
3. `--remove-config`: `domain.json` も消す（既定は `domain.json` だけ残してドメインディレクトリの中身を消す）
4. `-i` のときは今までの対話（名前の再入力 → 追加ディレクトリの選択 → domain.json を消すか → 確認）

削除するもの: `src/features/<domain>/`（`domainEntry.ts` ごと）、`src/app/admin/(protected)/<domains>/`（`_components/` 含むルートごと）、選んだ追加ディレクトリ。レジストリからは `adminDomains.ts` / `schemaRegistry.ts` / `domainConfigRegistry.ts` の該当行を消し、`serviceRegistry.ts` は残った domainEntry.ts から `pnpm generate registry` で作り直し、feature-map を書き直す。DB のテーブルは消さない。

- `domainConfigMap` のエントリは、オブジェクト直下のキーが完全一致するものだけを複数行ごと消す（`text/objectEntry.mjs` の `removeObjectEntry`）
- レジストリの更新に失敗してもディレクトリ削除は済んでいるため止めず、最後に手で直すファイルを表示して終了コード 1 で終わる

---

## 生成されるもの

カテゴリと出力先（`<domain>` = camelCase 単数、`<domains>` = kebab-case 複数）。生成器は `render/<カテゴリ>/`。カテゴリの一覧は `spec/categories.mjs`。

| カテゴリ | 出力 |
|---|---|
| `entities` | `entities/{model,form,schema,index}.ts` + `drizzle.ts`（Firestore なら `firestore.ts`）。主の集まりの項目（mediaCollection）は列を出さず、スキーマ = `z.array(storageMediaValueSchema)`（required → `.min(1)`、`collection.maxItems` → `.max`）、モデル = `string[]`（省略可）。主は表の定義の後に `defineTableCollections(<Domain>Table, () => import(…/collections))` を出す |
| `components` | `components/Admin<Domain>{Create,Edit,List}/`、`components/common/{Create<Domain>Form,Edit<Domain>Form,<Domain>Form,<Domain>Fields}.tsx`。`useDetailModal` で `<Domain>DetailModal.tsx`、`sortOrderField` で `Admin<Domain>Sort/`（一覧は `render/components/catalog.mjs`）。`<Domain>Fields` は主の集まりの項目に、従属の `file` の用途・accept・上限サイズと集まりの件数を載せる |
| `hooks` | `hooks/use*<Domain>.ts`（どれが生成されるかは `render/hooks/catalog.mjs`、使い方は [`src/lib/crud/hooks/README.md`](../../../src/lib/crud/hooks/README.md)） |
| `clientServices` | `services/client/<domain>Client.ts` |
| `serverServices` | `services/server/drizzleBase.ts`（Firestore なら `firestoreBase.ts`）、`services/server/<domain>Service.ts`（無いときだけ）、`wrappers/`（無ければ作成）。メディア列（mediaUploader）があれば drizzleBase に `storage: storageBindingFor(...)`（[src/lib/crud/README.md](../../../src/lib/crud/README.md)「storage オプション」）。Firestore ドメインのメディア列は生成エラー。主の集まりの項目があれば drizzleBase が `collections` を import して options に渡す（`generate: false` の主は自分で足す。渡し忘れは `pnpm test scripts/structure/registry/collectionWiring/collectionWiring.test.mjs` が見つける） |
| `fieldConstants` | `constants/field.ts` と `types/field.ts`（`options` を持つフィールドがあるときだけ） |
| `adminRoutes` | `src/app/admin/(protected)/<domains>/` の一覧・`new/`・`[id]/edit/`（`sortOrderField` で `sort/`） |
| `registry` | `services/server/domainEntry.ts`（`apiAccess` / `useImportExport` を `access` に展開し、`table` / `idColumn` を書く）、メディア列があれば `services/server/storagePurposes.ts`（毎回上書き）。主の集まりの項目があれば `services/server/collections.ts`（毎回上書き） |
| `presenters` | `presenters.ts`（一覧・詳細表示のフォーマッタ。答えは `src/lib/domain/fields/presenterFor.mjs`。メディア列は `formatMediaThumbnail(s)`） |
| `featureGate` | `closable: true` のときだけ（Neon のみ）: `src/featureGate/rules/<domain>.ts`（閉じる規則: `pathPatterns` = `/admin/<domains>`、`features` = ドメインのフォルダ、`enabled` = ドメインの config）と `config.ts`（`<SNAKE>_CONFIG = { enabled }`、既定 Tier1 = false・fork = true）。どちらも write-once（`render/featureGate/`、テスト `pnpm test scripts/structure/domain/tests/featureGateScaffold.test.mjs`）。一覧への反映は `pnpm generate extensions`（forge は続けて回す） |

生成される client の部品（`components` カテゴリ）は domain.json を import せず、写し `entities/display.ts` の `domainDisplay` を読む（`pnpm generate registry` が書く。写す項目: [`src/lib/domain/README.md`](../../../src/lib/domain/README.md)）。

### 上書きの扱い

| 扱い | 対象 |
|---|---|
| 毎回上書き（編集しない） | 上表のファイル全部（write-once を除く）。`drizzleBase.ts`・`presenters.ts`・`constants/field.ts`・`<Domain>Fields.tsx` も含む。`components` は一括操作の受け口の宣言 `extensionPoints.ts` と型 `types/adminBulkAction.ts` も書く（生成されるドメインの宣言は生成器が持つ。別の受け口が要るなら `"generate": false` にして手で持つ）。項目の `adminBulkActions/` は触らない |
| 初回だけ生成（write-once） | `closable: true` の規則 `src/featureGate/rules/<domain>.ts` と `config.ts`、管理画面ルートの `page.tsx`（1 行スイッチ。旧形式なら一度だけスイッチ形へ移行）、`services/server/<domain>Service.ts`（`base` にラッパー・独自処理を組み込む手書きの場所。既存の旧 `wrappers/duplicate` の組み込みは警告。テスト: `pnpm test scripts/structure/domain/tests/serverServiceWriteOnce.test.mjs`）。作り直すときはファイルを消してから生成する |
| 毎回再生成 | 管理画面ルートの `_screen/Admin<Domain>{List,Create,Edit,Sort}Screen.tsx` |
| 触らない（fork 所有） | 管理画面ルートの `_components/`、`wrappers/` に自分で置いたファイル、`hooks/` に自分で置いた生成名と異なるファイル |
| 作らない（`pnpm generate registry`） | `src/registry/` の schemaRegistry / domainConfigRegistry / storagePurposeRegistry / adminDomains（走査で丸ごと） |
| 毎回上書き（生成物） | `services/server/domainEntry.ts`（`apiAccess` が無ければ fail-closed = `...ADMIN_ONLY`、`useImportExport: true` のときだけ export / import を開く。`table` = `domain/names.mjs` の `domainTableName`、`idColumn` = `"id"`、Firestore は両方 `null`）。`src/registry/serviceRegistry.ts`（全 domainEntry.ts から `pnpm generate registry` が丸ごと生成。仕組みは `src/lib/domain/README.md`） |

管理画面ルートの構造（`page.tsx` / `_screen/` の Screen と loader.ts）は [`src/lib/screens/README.md`](../../../src/lib/screens/README.md) §12。

### 生成物を変えたいとき（生成ファイルは編集しない）

- **項目・選択肢・表示列など** → `domain.json` を直して `pnpm forge`
- **フォームに独自項目・差し込み UI** → 生成された `<Domain>Form` / `<Domain>Fields` は FieldRenderer の props（`fieldPatches` / `insertBefore` / `insertAfter` / `fieldGroups` / `beforeField` 等）を受け取る。fork 所有の `_components/` から渡す（[`src/components/Form/FieldRenderer/README.md`](../../../src/components/Form/FieldRenderer/README.md)）
- **管理画面のレイアウト** → `_screen/` を同じルートの `_components/` にコピーして `page.tsx` を向ける
- **CRUD の振る舞い** → `services/server/wrappers/` に置き、write-once の `<domain>Service.ts` で組み込む
- **一覧の一括操作** → 生成された受け口 `adminBulkActions/` に項目を 1 ファイルずつ置いて `pnpm generate extensions`（`Table.tsx` には書かない。書き方: [`src/lib/tableSuite/README.md`](../../../src/lib/tableSuite/README.md)「一括操作の受け口」）。項目が無ければ一覧は選択の無い素の表
- 生成ファイルを手で直す必要が出た・載せ替えが手間になった → そのドメインを `"generate": false` にする（以後は生成器が何も書かない。`--only` で名指ししても書かない）

---

## 典型的な流れ

新規ドメイン・項目の追加:

1. `src/features/<camelCase>/domain.json` を手で書く・直す（スキーマと例: [src/features/README.md](../../../src/features/README.md)。`src/features/sample/domain.json` が全機能の例）
2. `pnpm forge`（検査で止まったら文のとおりに直してもう一度）
3. `git status` / `git diff` で生成物を確認
4. 表が変わったら forge の最後の案内どおり `pnpm db:push`（人が実行）→ `pnpm db:push:check` で差分ゼロ（CLAUDE.md DOMAINS push_roundtrip）

テンプレート（`_template/`）や生成器を変えたとき: `pnpm generate domain` で全ドメインへ反映し、差分を確認してサンプルの再生成結果も一緒にコミットする（`pnpm test scripts/structure/domain/tests <ref>` で前後比較）。

## よくある失敗

- 生成が `[<domain>] ...` の文を並べて止まる → domain.json の決まり（必須キー・項目名と従属名の snake_case・外部キーの型・enum の選択肢・既定値・メディアの accept・一覧の設定の名前・廃止した `generateFiles`）に反している。文のとおりに直す（規則の一覧: [src/features/README.md](../../../src/features/README.md)「domain.json スキーマ定義」）
- `[domain.json] <domain>: ...` の警告が出る → 綴り違いのキー、古いキー（`version` → `domainConfigVersion`、`onDeleteCascade` → `onDelete`）、その DB に無い `fieldType`、知らない `formInput`、表に無い型と入力欄の組、選択肢の要る入力欄に options が無い、など（`checks/vocabulary.mjs` と各検査の `*Warnings`）。生成は止まらないが、未知の `fieldType` は列名としてそのまま出力され、未知の `formInput` はフォームに出ないので直す。知らないキーは同じキーをドメインごとに 1 行（件数と最初の 3 か所）にまとめ、他の警告の後ろに並べる。開発者のメモは `"$comment"`（どの階層でも通り、生成物にも写しにも出ない。`src/features/README.md`「開発者のメモ（$comment）」）
- `domain.json` が壊れている（JSON として読めない） → 直してから再実行
- `テンプレートのトークンが置換されていません` → 管理画面テンプレートに未対応のトークンが残っている。テンプレートを直す
- `src/features/feature-map.txt` が `--check` で落ちる → `pnpm generate domain -- --feature-map`（または forge）で作り直してコミット

---

## 生成器の構造（直す人向け）

生成は 1 本の流れで、層ごとに責務が分かれている。**render/ はファイルに触らず、書き込む内容（Output）を返す**。pipeline が全カテゴリの Output を集めてから書くので、途中の検査で止まっても書きかけが残らない。

```
cli/ → pipeline/ → render/ → domain/ → spec/          （依存は左から右への一方向）
```

| 層 | 役目 | 置いてよいもの |
|---|---|---|
| `index.mjs` `feature-map.mjs` `generate-client.mjs` | `pnpm generate domain` の振り分け先（入口は gate.json → `generateAll.mjs`） | |
| `cli/` | 引数の解釈（`args.mjs`: `--only`・値を取るオプション）、`main.mjs`（振り分け）、`generate` / `generateAll` / `delete` / `featureMap`、`-i` の対話（`prompts.mjs`・`pickCategories.mjs`）、`process.exit` | inquirer、process.exit |
| `pipeline/` | `generate.mjs`（1 ドメイン: 読む → 検査 → plan → 登録表の事前検査 → apply → serviceRegistry → feature-map。組なら `generateWithPairs`。カテゴリの決め方 `configTargets`）、`pairs.mjs`、`serviceRegistry.mjs`、`generateAll.mjs`、`plan.mjs`（カテゴリ順に render を呼ぶ）、`apply.mjs`（**唯一の書き込み点**）、`dryRun.mjs`（apply と同じ判定を読むだけで行い一覧する）、`remove/`（pnpm generate domain -- --delete の本体） | fs（apply / remove が書く、dryRun は読むだけ） |
| `render/<カテゴリ>/` | 生成物の文字列を組む純関数（`render/collections/` は主の集まりの項目から従属の domain.json を組む）。`(ctx, workspace) → Output[]`（`output.mjs`: `file` / `writeOnce` / `dir` / `patch` / `log`） | 読み取りは workspace 経由のみ |
| `checks/` | 生成前の検査（フォルダ名、廃止した型、Firestore のメディア列・集まり、domain.json の決まり = `required`・`names`・`relations`・`fields`・`media`・`viewConfig`）。`index.mjs` が全件を並べて止める。止めない食い違いは `*Warnings` と `vocabulary.mjs`。`pairs.mjs` = 組の検査、`accessRules.mjs` = アクセスルールの広さ。ロール・プロフィールの検査も `checks/fields.mjs` を共用する（`scripts/structure/role/checks/`） | |
| `domain/` | `workspace.mjs`（rootDir からのパスと読み取り。**fs を読むのはここだけ**）、`context.mjs`（名前の全形 + domain.json）、`names.mjs`（表名・FK 名・63 字）、`featureMap.mjs`（feature-map の中身）、`relations.mjs`、`fieldName.mjs`、`roles.mjs` | |
| `spec/` | 語彙: `categories.mjs`（カテゴリと `generateTargets` = generate の旗から作るカテゴリ）、`fieldTypes.mjs`（型の表 `src/lib/domain/fields/fieldTypes.mjs` の再 export）、`domainJson.mjs`（キーの集合）、`collectionField.mjs`（従属の既定の名前・snake_case）(型と入力欄の組の表は `src/lib/domain/fields/fieldFormInputs.mjs`、アプリのテストも読むので lib)、`format.mjs`（整形）、`version.mjs` | 定数と純関数のみ |
| `text/` | TS ソースの部分編集（`objectEntry.mjs`。scripts/structure/registry も使う） | |
| `tests/` | 全テスト（`structure.test.mjs` が下の規則を機械で検査する） | |

規則（`pnpm test scripts/structure/domain/tests/structure.test.mjs`）: 1 ファイル 200 行以内（テスト 320）| `spec/` `domain/`（workspace 以外）`checks/` `render/` `text/` は fs・child_process・inquirer・process.exit を使わない | fs は `domain/workspace.mjs` `pipeline/apply.mjs` `pipeline/dryRun.mjs` `pipeline/remove/` `cli/` だけ | inquirer と process.exit は `cli/` だけ | `render/` は `pipeline/` `cli/` を import しない。

よくある変更の置き場:

- **項目の種類を足す**（例: 新しい fieldType） → 型の表 `src/lib/domain/fields/fieldTypes.mjs` に行（属性と `formDefault`）、`src/lib/domain/fields/fieldFormInputs.mjs` に入力種別、各 `render/` は述語で分岐（型名を比べない: lint `field-type-guard`）。フォーム側の手書きは `src/components/Form/Field/types.ts` の型の名前だけ（ずれは `pnpm test src/components/Form/FieldRenderer/defaultValueBuilder.test.ts` と typecheck が検知する）
- **生成ファイルを足す** → そのカテゴリの `render/<カテゴリ>/` に `(ctx, workspace) → Output` を足し、カテゴリの `index.mjs` の配列に並べる（hooks / components は `catalog.mjs` に 1 行）
- **生成前の検査を足す** → `checks/` に「エラー文の配列」を返す関数を足し、`checks/index.mjs` に並べる（止めないものは警告の関数に）。テストは `tests/checks.test.mjs`（`pnpm test scripts/structure/domain/tests/checks.test.mjs`）
- **drizzleBase に配線を足す** → `render/serverServices/`（テンプレートのトークンに差し込む）か、別ファイルとして `Output` を 1 つ足す
- **複数ドメインの生成順** → `pipeline/generateAll.mjs` と `domain/`（`workspace.listDomains` + `readConfig`）

テスト: `pnpm test scripts/structure/domain/tests/structure.test.mjs` `pnpm test scripts/structure/domain/tests/registry.test.mjs` `pnpm test scripts/structure/domain/tests/vocabulary.test.mjs` `pnpm test scripts/structure/domain/tests/checks.test.mjs` `pnpm test scripts/structure/domain/tests/featureMap.test.mjs` `pnpm test scripts/structure/domain/tests/dryRun.test.mjs` `pnpm test scripts/structure/domain/tests/registryPrecheck.test.mjs` `pnpm test scripts/structure/domain/tests/domainFolder.test.mjs` `pnpm test scripts/structure/domain/tests/onlyOption.test.mjs` `pnpm test scripts/structure/domain/tests/serverServiceWriteOnce.test.mjs` `pnpm test scripts/structure/domain/tests/drizzleIndexes.test.mjs` `pnpm test scripts/structure/domain/tests/sampleDrift.test.mjs` `pnpm test scripts/structure/domain/tests/storageOutput.test.mjs` `pnpm test scripts/structure/domain/tests/collectionField.test.mjs` `pnpm test scripts/structure/domain/tests/childDomain.test.mjs` `pnpm test scripts/structure/domain/tests/pairGenerate.test.mjs` `pnpm test scripts/structure/domain/tests/pairChecks.test.mjs` `pnpm test scripts/structure/domain/tests/deleteStop.test.mjs` `pnpm test scripts/structure/domain/tests/parentOutputs.test.mjs` `pnpm test scripts/structure/domain/tests/plural.test.mjs`（`tests/`。生成器は関数なので一時ディレクトリに domain.json を置いて直接呼ぶ）。

### 前後比較（`pnpm test scripts/structure/domain/tests <git-ref>`）

生成器を変えたら、変える前のコミットの生成器と作業ツリーの生成器を**同じ fixture に流して**、生成物・終了コード・出力行が同じかを見る（`tests/parity.mjs`）。「生成物を変えないつもりの変更」はこれが空になるまで直す。生成物を変える変更では、差分が意図したものだけかを目で確かめる。

- fixture: `samples`（このリポの src/ そのまま）、`synthetic` / `synthetic-bad`（`tests/fixtures/parity/<name>/<domain>/domain.json`。Firestore・hiddenColumns・63 字超の FK・空スキーマ・入れ子リレーション・メディア列・旧形式のキーと、検査で止まる失敗系。主の集まりの項目の組 = `showcase` と `atelier`）。`--repo <path>` で fork のリポを足せる
- mode: `each`（1 ドメインずつ）、`all`、`all2`（2 回 = 冪等性）、`only-registry`、`only-entities-hooks`。`--modes` / `--variants` / `--fixtures` で絞る、`--keep` で作業ディレクトリを残す
- 失敗系は両版が同じ exit code・同じエラー文で止まることを見る。差分の詳細は FAIL 行の report（JSON）に出る
- 旧側の src 部品: テンプレート（`src/features/_template`・`src/app/admin/_template`）は ref のものを使う。生成器は src の `.mjs`（型の表 `src/lib/domain/fields`、`src/lib/domain/relations`、`src/utils`）も import するので、旧側は ref の生成器の import を辿ってそのフォルダも ref から取り出して重ねる（表・`presenterFor` の変更も差分に出る）。ref に無いフォルダは作業ツリーのまま使い、起動時に重ねたフォルダとともに表示する。重ねたフォルダ（新側が import するフォルダも）は生成物ではないので比べない
- 対話（`-i`）の経路は対象外
- 旧側は ref の生成器で動くので、ref より後に入った domain.json の形（`generate` の旗など）は旧側で読めない。そうした変更の前後は `--dry-run` の比較で確かめる
- 新しい形の domain.json を生成器が受けるようになったら、`tests/fixtures/parity/synthetic/` にその例を 1 つ足す

サンプルの陳腐化検査: `pnpm test scripts/structure/domain/tests/sampleDrift.test.mjs` は `sample` / `sampleCategory` / `sampleTag` / `sampleImage` を一時ディレクトリへ複製したうえで再生成し、コミット済みの生成物と 1 バイトでも違えば落ちる（作業ツリーは書き換えない）。`sample.images` = 主の集まりの項目（mediaCollection）の例で、従属 `sampleImage` を持つ。存在しないサンプルドメインは対象から外し、全部無ければスキップする。
