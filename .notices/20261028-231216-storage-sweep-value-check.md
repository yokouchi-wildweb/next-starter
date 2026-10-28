# DOWNSTREAM NOTICE id:20261028-231216-storage-sweep-value-check
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-28T23:12:16+09:00
severity: action-required
checkpoint: storage-sweep-value-check
change: 掃除 cron（storage-sweep）の照合が、行の有無に加えて「紐付け先の列の値にまだ ref が入っているか」も見るようにした（値の照合）。列が消えた = `column_missing`、列はあるが値に無い = `value_missing`。扱いは新しい設定 `STORAGE_CONFIG.sweep.reconcile.valueCheck`（`"off" | "report" | "detach"`、既定 `"report"` = 件数を結果と警告に出すだけで消さない）。`"detach"` なら外して（台帳の reason `unreferenced`）実物を消す。あわせて、storage オプションのメディア列を hiddenColumns にすると createCrudService が組み立て時に throw するようにした
why: 列の削除（domain.json からメディア項目を消して db:push）・生 SQL・一度きりの移行など、アプリを通らずに値から外れた ref のファイルが、台帳上「使用中」のまま残り続けて消えなかった。消す挙動を全 fork で黙って変えないよう、既定は報告だけにしてある
required_actions:
1. 上流を merge する
2. `src/config/app/storage.config.ts` を fork で書き換えていれば、`sweep.reconcile` に `valueCheck: "report" as "off" | "report" | "detach",` が入っていることを確かめる（衝突したら上流の行を残す）
3. メディア列を hiddenColumns にしていないか確かめる: `grep -rn "defineHiddenColumns(" src/features --include=drizzle.ts` と、各 domain.json の `hiddenColumns` に mediaUploader の項目名が無いこと。あれば hiddenColumns から外す（ファイルの公開範囲は用途の read 規則で守る）
4. `pnpm typecheck` `pnpm lint` を通す
verify: `pnpm typecheck` `pnpm lint` が通る | `pnpm test:storage-purposes`（登録済みの全サービスが組み立てられる = メディア列 × hiddenColumns の違反が無い）と `pnpm test:storage-object` が通る | デプロイ後の storage-sweep の戻り値に `reconcile.unreferenced`（配列）が出る
manual_steps: デプロイ後、storage-sweep の結果（Vercel のログの `[storage-sweep] 照合: <表>.<列> の値に入っていない紐付けが N 件あります` の警告、または `pnpm task storage-sweep` の戻り値の `reconcile.unreferenced`）を確かめる。件数が 0、または出た表・列がすべて「本当に使われていない」（列を消した後・値を書き換えた後）と確かめられたら、`STORAGE_CONFIG.sweep.reconcile.valueCheck` を `"detach"` にしてデプロイする。コードを先にデプロイして db:push が後の間と、移行で台帳の付け替えが済んでいない間は `"detach"` にしない（DB に残る値のファイルを消す）
refs: src/features/core/storageObject/README.md「値の照合」, src/features/core/storageObject/services/server/sweep.ts, src/config/app/storage.config.ts, src/lib/crud/drizzle/service.ts（hiddenColumns × storage の検査）, .claude/rules/core/crud-service.md media_value_check
notes:
- DB の変更なし（台帳の reason は text 列。`unreferenced` を足しただけ）
- クエリは増えない（照合で読んでいる業務行の値を、ref の中の台帳 ID で比べる）。台帳から読む列が record_field の 1 つ増えるだけ
- 大量一致: 列はあるのに 1 つの束でその列の値が massMissingMin（既定 50）以上 1 件も入っていなければ、`"detach"` でも消さない（action `held`）。列そのものが無い場合は使わない
- record_field が null の古い紐付けは値を見ない
- 上流の既定値は "report" のまま出す。生成器から mediaUploaderMulti を消す後続の作業（sample の gallery_images の列を落とす）での台帳の片付けは、その作業の notice で扱う
- fork の状態: メディア列 × hiddenColumns は 88-base TriQ boardgame-site next-vnx oripa-demo oripa-do oripa-do-2 の domain.json と defineHiddenColumns を upstream 側で調べて 0 件。各 fork の台帳に unreferenced がどれだけ出るかは not checked
- 削除・移動なし
