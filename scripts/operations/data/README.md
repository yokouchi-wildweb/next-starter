# scripts/operations/data — 全ドメイン共通のデータ操作(pnpm ops data)

登録表のどのドメインにも同じ形で使う、書き出し・取り込み・一括更新・一括削除のコマンド(D72)。各ドメインに置かず、雛形も作らない。中身はそのドメインのサービスの関数を呼ぶだけで、lib/crud を直接呼ばない。

```bash
pnpm ops data export <domain> --out <file.jsonl> [--with-deleted] [--limit <n>]
pnpm ops data import <domain> --file <file.jsonl> [--dry-run]
pnpm ops data update <domain> --file <file.jsonl> [--dry-run]
pnpm ops data delete <domain> (--ids <id>[,<id>...] | --file <file>) [--dry-run]
```

- `<domain>` = 登録表(`src/registry/serviceRegistry.ts`)のキー(camelCase。snake_case も読む)
- 本番は `--env production --confirm=production`(書く入口の守り: `scripts/runner/guard/README.md`。export は読むだけなので確認なし)

## 許可

`resolveDataCommand`(`src/lib/domain`、README「データ操作のコマンド(pnpm ops data)の許可」)が決める。

- export → 操作 `export` の規則 / サービスの `search`(`--with-deleted` は `searchWithDeleted`)、import → `import` / `bulkUpsert`、update → `bulkUpdate` / `bulkUpdate`、delete → `bulkDeleteByIds` / `bulkDeleteByIds`
- 管理 API で何かしらのロールに許した操作は許す。export / import はドメインの管理データ操作(domain.json の `useImportExport`)が開いている時だけ
- ドメインごとの上書き: `access.commands`(`"allow"` / `"deny"`)。業務ドメインは domain.json の `apiAccess.commands`
- サービスに無い関数は止める(例: user は `import` 閉じ・`delete` はサービスが `bulkDeleteByIds` を公開しないので閉じ、`update` は列を限った `userService.bulkUpdate`)
- 許さない・知らないドメインは理由を出して exit 1(何もしない、記録も書かない)

## ファイルの形(JSON Lines)

- 1 行 1 件の JSON オブジェクト。空行は飛ばす。JSON に無い型は印つき: 日時 = `{ "$date": "<ISO>" }`(読む時に戻す)。配列・jsonb・null・数値・真偽はそのまま
- export → import で型・配列・日時・null がそのまま戻る(`roundtrip.db.test.ts`)
- update: 1 行 `{ "id": "<id>", "<列>": <値>, ... }`(書いた列だけ変える)
- delete の `--file`: 1 行 1 id か、export の行(`{ "id": ... }`)。`#` の行と空行は飛ばす
- 1 ファイル(delete は 1 回の id)は 1,000 件まで。超えるなら分ける
- メディア(ファイル)の列と集まり(mediaCollection の子)は import / update で書かない(storage の binding を通す物。値のあった列は結果の `mediaSkipped` に出る)。ファイルごと運ぶのは管理画面のデータ移行(CSV + ZIP)
- 秘匿の列(hiddenColumns)はサービスが null にして返すので、export に値は出ない

## 書き込みの流れ(import / update / delete)

- 1 ファイル = サービスの 1 回の呼び出し(`bulkUpsert` は 1 文、`bulkUpdate` / `bulkDeleteByIds` は 1 つの transaction)= 全部か無し
- `--dry-run`: ファイルの確かめ(読める・件数・update の id と変える列・id の重なり)と件数だけ。書かない
- 実行の記録: `task_runs` に kind `data`、名前 `data:<command>:<domain>`、引数を書き、run id を監査の requestId にする(`pnpm task` と同じ流れ `scripts/runner/task/execute.ts`)
- 止める鍵 `data:<command>:<domain>:<中身の sha256>`(delete は並べ替えた id): 同じ中身を二度当てない。意図して同じ物をもう一度当てるなら、確かめてから `pnpm task --resolve <runId> failed`
- 書く前に止めた・サービスが拒んだ(`DomainError`、何も書いていない)= failed で鍵を取らない(直して打ち直せる)。接続が切れた等で分からない時は結果不明(鍵を持つ。確かめて `pnpm task --resolve`)

## しないこと

- 条件で選んで一括で書き換える・消す形と全件削除(全件削除は管理画面の truncate)。行はファイルか id で名指す
- 他のドメインの状態の後始末(サービスの守りに任せる。例: user のステータスは `pnpm task user:bulk-change-status`)

## テスト

- `pnpm test scripts/operations/data`(JSON Lines・引数・確かめ・鍵)
- `pnpm test --db scripts/operations/data/roundtrip.db.test.ts`(開発 DB で本物のコマンドを打つ往復と user の拒否)
- 許可の表: `pnpm test scripts/structure/registry/dataCommands.test.mts`
