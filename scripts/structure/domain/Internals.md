# ドメイン生成 CLI（pnpm generate domain） — Internals

## Overview

- `README.md` の Internals の節を分けた文書(生成の流れ・主と従属の組・生成器の構造・前後比較)

## Internals

### 生成の流れ（`pipeline/generate.mjs`）

- 読む → 検査（`checks/`、全件を並べて止める）→ 全カテゴリの生成物を組み立てる → 書いた後の状態で `serviceRegistry.ts` が作れるか確かめる → 書く → `serviceRegistry.ts` を作り直す → 地区の地図 `district-map.jsonl` を書き直す
- 組み立てでは、主の集まりの項目 `mediaCollection` があれば、従属の domain.json を無いときだけ書き出す Output も足す（`render/collections/`。雛形の形と権限の写し: [src/features/Extension.md](../../../src/features/Extension.md)「主の集まりの項目（mediaCollection）」）
- 登録表が作れない状態（手書きの行が残っている、他のドメインに `domainEntry.ts` が無い）なら何も書かずに止まる

`pnpm generate domain` は全ドメインの生成物を先に組み立て、登録表が作れることを確かめてから書き始めるので、途中のドメインで止まって半端に残ることはない。テンプレートを変えたあとの一括反映に使う。

#### 主と従属の組（`pipeline/pairs.mjs`）

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

### 生成器の構造（直す人向け）

生成は 1 本の流れで、層ごとに責務が分かれている。**render/ はファイルに触らず、書き込む内容（Output）を返す**。pipeline が全カテゴリの Output を集めてから書くので、途中の検査で止まっても書きかけが残らない。

```
cli/ → pipeline/ → render/ → domain/ → spec/          （依存は左から右への一方向）
```

| 層 | 役目 | 置いてよいもの |
|---|---|---|
| `index.mjs` `generate-client.mjs` | `pnpm generate domain` の振り分け先（入口は gate.json → `generateAll.mjs`） | |
| `cli/` | 引数の解釈（`args.mjs`: `--only`・値を取るオプション）、`main.mjs`（振り分け）、`generate` / `generateAll` / `delete`、`-i` の対話（`prompts.mjs`・`pickCategories.mjs`）、`process.exit` | inquirer、process.exit |
| `pipeline/` | `generate.mjs`（1 ドメイン: 読む → 検査 → plan → 登録表の事前検査 → apply → serviceRegistry → 地区の地図。組なら `generateWithPairs`。カテゴリの決め方 `configTargets`）、`pairs.mjs`、`serviceRegistry.mjs`、`generateAll.mjs`、`plan.mjs`（カテゴリ順に render を呼ぶ）、`apply.mjs`（**唯一の書き込み点**）、`dryRun.mjs`（apply と同じ判定を読むだけで行い一覧する）、`remove/`（pnpm generate domain -- --delete の本体） | fs（apply / remove が書く、dryRun は読むだけ） |
| `render/<カテゴリ>/` | 生成物の文字列を組む純関数（`render/collections/` は主の集まりの項目から従属の domain.json を組む）。`(ctx, workspace) → Output[]`（`output.mjs`: `file` / `writeOnce` / `dir` / `patch` / `log`） | 読み取りは workspace 経由のみ |
| `checks/` | 生成前の検査（フォルダ名、廃止した型、Firestore のメディア列・集まり、domain.json の決まり = `required`・`names`・`relations`・`fields`・`media`・`viewConfig`）。`index.mjs` が全件を並べて止める。止めない食い違いは `*Warnings` と `vocabulary.mjs`。`pairs.mjs` = 組の検査、`accessRules.mjs` = アクセスルールの広さ。ロール・プロフィールの検査も `checks/fields.mjs` を共用する（`scripts/structure/role/checks/`） | |
| `domain/` | `workspace.mjs`（rootDir からのパスと読み取り。**fs を読むのはここだけ**）、`context.mjs`（名前の全形 + domain.json）、`names.mjs`（表名・FK 名・63 字）、`relations.mjs`、`fieldName.mjs`、`roles.mjs` | |
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

テスト(`tests/`。生成器は関数なので一時ディレクトリに domain.json を置いて直接呼ぶ):

- `pnpm test scripts/structure/domain/tests/structure.test.mjs`
- `pnpm test scripts/structure/domain/tests/registry.test.mjs`
- `pnpm test scripts/structure/domain/tests/vocabulary.test.mjs`
- `pnpm test scripts/structure/domain/tests/checks.test.mjs`
- `pnpm test scripts/structure/domain/tests/generateTargets.test.mjs`
- `pnpm test scripts/structure/domain/tests/dryRun.test.mjs`
- `pnpm test scripts/structure/domain/tests/registryPrecheck.test.mjs`
- `pnpm test scripts/structure/domain/tests/domainFolder.test.mjs`
- `pnpm test scripts/structure/domain/tests/onlyOption.test.mjs`
- `pnpm test scripts/structure/domain/tests/serverServiceWriteOnce.test.mjs`
- `pnpm test scripts/structure/domain/tests/drizzleIndexes.test.mjs`
- `pnpm test scripts/structure/domain/tests/sampleDrift.test.mjs`
- `pnpm test scripts/structure/domain/tests/storageOutput.test.mjs`
- `pnpm test scripts/structure/domain/tests/collectionField.test.mjs`
- `pnpm test scripts/structure/domain/tests/childDomain.test.mjs`
- `pnpm test scripts/structure/domain/tests/pairGenerate.test.mjs`
- `pnpm test scripts/structure/domain/tests/pairChecks.test.mjs`
- `pnpm test scripts/structure/domain/tests/deleteStop.test.mjs`
- `pnpm test scripts/structure/domain/tests/parentOutputs.test.mjs`
- `pnpm test scripts/structure/domain/tests/plural.test.mjs`

#### 前後比較（`pnpm check domain -- --parity <git-ref>`）

生成器を変えたら、変える前のコミットの生成器と作業ツリーの生成器を**同じ fixture に流して**、生成物・終了コード・出力行が同じかを見る（`tests/parity.mjs`）。「生成物を変えないつもりの変更」はこれが空になるまで直す。生成物を変える変更では、差分が意図したものだけかを目で確かめる。

- fixture: `samples`（このリポの src/ そのまま）、`synthetic` / `synthetic-bad`（`tests/fixtures/parity/<name>/<domain>/domain.json`。Firestore・hiddenColumns・63 字超の FK・空スキーマ・入れ子リレーション・メディア列・旧形式のキーと、検査で止まる失敗系。主の集まりの項目の組 = `showcase` と `atelier`）。`--repo <path>` で fork のリポを足せる
- mode: `each`（1 ドメインずつ）、`all`、`all2`（2 回 = 冪等性）、`only-registry`、`only-entities-hooks`。`--modes` / `--variants` / `--fixtures` で絞る、`--keep` で作業ディレクトリを残す
- 失敗系は両版が同じ exit code・同じエラー文で止まることを見る。差分の詳細は FAIL 行の report（JSON）に出る
- 旧側の src 部品: テンプレート（`src/features/_template`・`src/app/admin/_template`）は ref のものを使う。生成器は src の `.mjs`（型の表 `src/lib/domain/fields`、`src/lib/domain/relations`、`src/utils`）も import するので、旧側は ref の生成器の import を辿ってそのフォルダも ref から取り出して重ねる（表・`presenterFor` の変更も差分に出る）。ref に無いフォルダは作業ツリーのまま使い、起動時に重ねたフォルダとともに表示する。重ねたフォルダ（新側が import するフォルダも）は生成物ではないので比べない
- 対話（`-i`）の経路は対象外
- 旧側は ref の生成器で動くので、ref より後に入った domain.json の形（`generate` の旗など）は旧側で読めない。そうした変更の前後は `--dry-run` の比較で確かめる
- 新しい形の domain.json を生成器が受けるようになったら、`tests/fixtures/parity/synthetic/` にその例を 1 つ足す

サンプルの陳腐化検査: `pnpm test scripts/structure/domain/tests/sampleDrift.test.mjs` は `sample` / `sampleCategory` / `sampleTag` / `sampleImage` を一時ディレクトリへ複製したうえで再生成し、コミット済みの生成物と 1 バイトでも違えば落ちる（作業ツリーは書き換えない）。`sample.images` = 主の集まりの項目（mediaCollection）の例で、従属 `sampleImage` を持つ。存在しないサンプルドメインは対象から外し、全部無ければスキップする。

- domain.json の `closable`(閉じられる形の印)は受けない(`checks/closable.mjs`): 書けば true でも false でも生成の前に止めて、機能の規則の書き方を案内する(テスト `pnpm test scripts/structure/domain/tests/closableRetired.test.mjs`)。機能として閉じるには `src/featureGate/rules/<名前>.ts` に規則を書く(`src/featureGate/API.md`「規則の書き方」)
