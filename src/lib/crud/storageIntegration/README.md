# crud/storageIntegration

## Overview

- `storage://` の ref を保存するメディア列を、ファイル台帳（`src/features/core/storageObject/README.md`）と同じ TX で連動させる createCrudService の `storage` オプション（Drizzle のみ）。指定しないサービスの挙動は変わらない
- メディア列の書き込みはこの binding か `storageObjectService.attach` だけで行う（core/services.md media_columns）
- lib/crud が持つのは型（`types.ts` の `CrudStorageBinding`）と呼び出し口（`applyStorageBinding.ts`）だけ。台帳の操作は features 側の `storageBindingFor` が差し込む（lib → features の依存を作らない）

## Usage

- pnpm generate domain はメディア列を持つドメインの drizzleBase にこの binding を出す（purpose = `<domain>.<field>`）

```ts
import { storageBindingFor } from "@/features/core/storageObject/services/server";

createCrudService(SampleTable, {
  storage: storageBindingFor("sample", [
    { name: "main_image", purpose: "sample.main_image" },
    { name: "sub_image", purpose: "sample.sub_image" },
  ]),
});
```

- `multi: true` は 1 列の `text[]` に複数の ref を持つ列のための宣言（生成器の mediaUploaderMulti は廃止したので、手書きの列か移行前の列だけが使う）。新しく複数のメディアを持たせるなら集まり（`../collections/README.md`）にする
- メディア列は systemColumns にも hiddenColumns にもできない（どちらも createCrudService が組み立て時に throw する。hiddenColumns は戻り値で null になり、掃除の値の照合が誤るため）

## Internals

- **create / update / upsert**
  - 業務行を書いた直後に、同じ TX の中で `afterWrite` を呼ぶ。update / upsert は、書く前の行を `FOR UPDATE` で読む
  - 新しく現れた ref は attach する。紐付くのは次のときだけで、それ以外は 400 で TX ごと巻き戻る
    - 台帳の行が ready で、まだ紐付いていない
    - 用途と ref が一致する
    - 保存者がアップロードした本人である
  - 外れた ref は deleted（reason `replaced`）にし、実物は commit 後に消す
  - メディア列に触れない update は、台帳を連動させない
- **旧 URL（http(s)）**
  - update で前と同じ値のときだけ保持できる。新しい値と、create での保存は 400
  - import や複製では、`storageObjectService.copy` / `putFromServer` で新しい ref にする
  - 置換で外れた旧 URL の実物は消さない
- **物理削除**
  - 対象は `hardDelete` と、soft delete を使わない表の `remove` / `bulkDeleteByIds` / `bulkDeleteByQuery`
  - 削除する行を `FOR UPDATE` で読み、同じ TX で ref を deleted（reason `record_removed`）にする
  - 自分の旧バケットの旧 URL は、commit 後に実物ごと消す
  - `storageBindingFor(..., { onHardDelete: "keep" })` にすると何もしない（台帳と実物を残す。上流では使っていない選択肢）
- **soft delete・restore**: 何もしない。紐付けを残すので、restore で戻せる
- **duplicate**
  - TX の外で先に、メディア列を copy で新しい ref にする。所有者は実行者になる
  - そのあと新しい行を create し、そこで紐付ける
  - 1 件でも複製に失敗したら、複製全体を失敗にする（元行はそのまま）
- **replaceByQuery**
  - where に合う旧行を `FOR UPDATE` で読み、置き換えた直後に同じ TX の中で `afterReplace` を呼ぶ
  - 値ごとに、旧行全体と新しい行全体を比べる
    - 新しい行にだけある値: create と同じ規則で attach（旧 URL・他人の ref などは 400）
    - 同じ id の行に残る値: 何もしない（records に旧行の id を入れて送れば、紐付けはそのまま）
    - 別の id の行に移った ref: 台帳の紐付け先を新しい行へ付け替える（`storageObjectService.rebind`）。旧 URL は残すだけ
    - 旧行にだけある値: 物理削除と同じ扱い（ref は `record_removed`、自分の旧バケットの旧 URL は実物ごと消す。`onHardDelete: "keep"` なら残す）
  - 同じ値を新しい行の 2 か所に入れたら 400（共有は copy）
  - soft delete の表: 旧行は値を持ったまま残るので、紐付けも残す。旧行の値を新しい行に入れたら 400（restore で同じファイルを 2 行が指さないため）。records がメディア列に触れなければ台帳は連動させない
  - `afterReplace` を持たない binding（`storageBindingFor` 以外の自作）では、replaceByQuery を DomainError 400 で拒否する
- **bulkUpdateByIds / bulkUpdateByQuery / bulkUpdate / bulkUpsert**: メディア列を変える呼び出しは DomainError 400（行ごとの差分計算は初版の範囲外）。行ごとに update を使う
- **TX と後片付け**
  - 呼び出し元が tx を渡さなければ、内部で TX を張る。commit 後に `afterCommit` で実物を消す（ベストエフォート）
  - tx を渡された場合は、外側の TX がまだ commit されていないので消さない
  - どちらの場合も、消し残しは台帳に deleted・`object_removed_at` null として残り、掃除 cron が片付ける
- **actor**: routeFactory が敷く AuditContext の actorId。`runAsSystem` の中では null（所有者 null のサーバー内の書き込みだけが紐付く）。binding の紐付けのための読み出しで、業務の認可に使う手段ではない（[routeFactory README「業務処理に利用者が要るとき」](../../routeFactory/README.md)）
- **storageFields**: storage を指定したサービスは、binding の列の宣言（`name` / `purpose` / `multi` / `scope`）を読み取り専用の `service.storageFields` で出す。指定しないサービスでは undefined。どの列がメディア列かを知る正本で、dataMigration の import / export が使う（クライアントの申告は信用しない）
- **FK cascade**: メディア列を持つ表に、親の削除に伴う DB の `onDelete: "cascade"` を付けてよい
  - DB が消した行は binding を通らない。残った紐付けは、掃除 cron（`storage-sweep`）の照合が後の実行で外し、実物を消す（その場ではない。予算と上限つき。[storageObject README「掃除」](../../../features/core/storageObject/README.md)）
  - すぐ片付けたい表は、子の表の FK を `onDelete: "restrict"` にし、親のサービスの削除（remove / hardDelete の wrapper）の中で、同じ tx を渡して子のサービスの削除（`bulkDeleteByQuery` など）を先に呼ぶ（任意）
