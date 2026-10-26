# DOWNSTREAM NOTICE id:20261026-153450-storage-lifecycle
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-26T15:34:50+09:00
severity: action-required
checkpoint: storage-lifecycle
change: ファイル台帳の後片付け。(1) cron storage-sweep に照合（orphanedAttached）を追加: 紐付け先の業務行が消えた ready の台帳行（DB の onDelete cascade・手作業の DELETE などアプリを通らない削除）を、record_type → serviceRegistry の lookupDomainService → searchWithDeleted で確かめて detach（record_removed）し実物を消す。論理削除済みの行は残す。引けない record_type・大量一致・1 回の上限では消さずに警告する (2) ユーザーの物理削除（管理者の hard-delete）で、アバターと、その人がアップロードしてまだどこにも紐付いていないファイルの実物を消す。退会（論理削除）では消さない (3) 暫定の cascade 検査（test:storage-purposes の警告）と storageCascadeForeignKeys を廃止。メディア列を持つ表の onDelete cascade はそのまま使ってよい
why: storage.config.ts を変えている fork は、増えた sweep.reconcile のキーを取り込まないと型が合わない。storageBindingFor の record_type が serviceRegistry のキーと食い違う fork の紐付けは、照合で引けずに残り続ける（警告が出る）。users の storage binding や hardDelete wrapper を改造している fork は、ユーザーの物理削除でファイルが消えない。storageCascadeForeignKeys を参照している fork のコードは型が通らない
required_actions:
1. 上流を merge する。src/config/app/storage.config.ts を fork が変えていて衝突したら、fork の値を保ったまま `sweep.reconcile: { maxDetachPerRun: 1000, massMissingMin: 50 }` を足す（値は変えてよい。maxDetachPerRun = 1 回の照合で片付ける行数の上限、massMissingMin = 1 束で同じ record_type の ID がこの数以上あって 1 件も見つからなければ、その record_type は消さずに警告する閾値）
2. `pnpm registry:check` を実行する。fork の storageBindingFor の第 1 引数（record_type）が serviceRegistry のキー（domainEntry.ts）に無いと失敗する。失敗したら storageBindingFor の第 1 引数を domainEntry.ts のキーに揃える（台帳の既存の行は record_type が旧い名前のまま残るので、揃えた場合は `pnpm db:query "select record_type, count(*) from storage_objects where status = 'ready' and record_type is not null group by record_type"` で旧い名前の行が残っていないか確かめ、残っていればその扱いを人に確認する）
3. fork が src/features/core/user/services/server/drizzleBase.ts の users の storage binding や wrappers/hardDelete.ts を上書き・改造していれば、上流版に合わせる: users の binding は `onHardDelete: "keep"` を外す（既定 = 物理削除で detach）、hardDelete は `base.hardDelete(userId)` の後に `storageObjectService.discardAllOwnedBy(userId)` を try / catch で呼ぶ。改造していなければ何もしない
4. fork のコード・テストで storageCascadeForeignKeys を参照していればやめる（grep: `storageCascadeForeignKeys`）。fork が test:storage-purposes に独自の cascade の確認を足していれば消す（上流の describe「メディア列と FK cascade」は削除した）
5. 以前の notice（20261024-160000-storage-replace-by-query-cascade）に従って FK を restrict に変え、親の削除 wrapper で子を消している fork: そのままでよい（すぐ片付ける任意の道として残る）
6. `pnpm test:storage-purposes` `pnpm test:storage-object` `pnpm typecheck` `pnpm lint` を通す
verify: `pnpm registry:check` が OK | `pnpm test:storage-purposes` `pnpm test:storage-object` が通り、cascade の警告が出ない | `grep -rn storageCascadeForeignKeys src scripts` が 0 件 | `pnpm typecheck` `pnpm lint` が通る | DATABASE_URL があれば `pnpm test:storage-object-db` `pnpm test:storage-binding-db` も通る
manual_steps: 本番の cron storage-sweep の取り込み後の初回実行で、照合が既存の紐付けを初めて一巡する。Vercel の cron のログ（または手動実行の応答 JSON）で `reconcile.detached` と `reconcile.skipped` を確かめる。skipped に `mass_missing` があれば、台帳と業務表を突き合わせてから扱いを決める（確かめ方: src/features/core/storageObject/README.md「照合が止まったとき（skipped）」）。照合は予算と上限つきなので、台帳が大きい fork では一巡に数回の実行がかかる
refs: src/features/core/storageObject/README.md（規則のユーザーの物理削除・退会・公開の用途の実物とキャッシュ、掃除、照合が止まったとき）, src/features/core/storageObject/services/server/{sweep.ts,reconcileCursor.ts,storageObjectService.ts}, src/app/api/cron/storage-sweep/task.ts, src/config/app/storage.config.ts（sweep.reconcile）, src/features/core/user/services/server/{drizzleBase.ts,wrappers/hardDelete.ts}, src/features/core/user/README.md「退会と削除」, src/lib/crud/README.md「storage オプション」, src/lib/storage/README.md「全体の流れ」, .claude/rules/core/crud-service.md（media_fk_cascade）
notes:
- 20261025-164220-storage-cascade-check-warn の後継（あちらの「後の notice で入る台帳の照合」がこれ）。cascade の警告は出なくなる
- db:push は不要（照合の進み具合は既存の表 cron_checkpoints の行 `storage-sweep.reconcile` に持つ。台帳に列は足していない）
- 削除・移動なし（`git diff --name-status --diff-filter=DR` で確認）。追加: src/features/core/storageObject/services/server/reconcileCursor.ts
- API の変化: 公開の型 StorageFieldsAugmented と createCrudService のサービスから storageCascadeForeignKeys を削除。StorageLedger に listAttached / listUnattachedOwnedBy を追加（fork が自前の台帳実装を持っていれば足す）。storageObjectService に discardAllOwnedBy を追加。createStorageSweep の deps に reconcileCursor が増えた（runStorageSweep を使っていれば既定が入る。createStorageSweep を直接呼ぶ fork は reconcileCursor を渡す）。cron の戻り値に orphanedAttached と reconcile が増えた
- onHardDelete: "keep" の選択肢は残る（上流での利用は無くなった）
- ユーザー・購入申請を物理削除すると、振込明細（bank_transfer_reviews）の行は DB の cascade で消え、その画像は照合が次の実行で消す。経理で残すなら物理削除せず退会（論理削除）を使う
- 公開の用途の実物は 1 年の immutable で配信するので、消してもブラウザ・CDN のキャッシュに残りうる。消すことを約束する文書（プライバシーポリシー等）では、非公開の用途を使うか、この限界を書く
- core ルール crud-service.md の media_fk_cascade 行を書き換えた（fork は編集しない）
- fork の状態: not checked
