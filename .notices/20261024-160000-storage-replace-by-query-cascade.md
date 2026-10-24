# DOWNSTREAM NOTICE id:20261024-160000-storage-replace-by-query-cascade
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-24T16:00:00+09:00
severity: action-required
checkpoint: storage-replace-by-query-cascade
change: createCrudService の storage オプションが replaceByQuery を台帳と連動させるようになり（attach / 付け替え / record_removed）、メディア列を持つ表の FK onDelete cascade を pnpm test:storage-purposes が検出して失敗させるようになった
why: これまで storage オプション付きサービスの replaceByQuery は台帳を通らず、挿入した ref は未採用のまま sweep に実物を消され、消した行の ref は紐付いたまま実物が漏れていた。DB の FK cascade で消えた行も同じく漏れる。修正に伴い replaceByQuery が新たに 400 を返す入力があり、fork 独自の表の cascade はテストで落ちる
required_actions:
1. `pnpm test:storage-purposes` を実行する。「storage オプション付きサービスは、親の削除で DB に消される FK を持たない」が fork の表を挙げて落ちたら、表ごとに次を行う: 子の表（メディア列を持つ側）の FK を `onDelete: "restrict"` に変える → 親のサービスの削除（remove / hardDelete の wrapper）の中で、同じ tx を渡して子のサービスの削除（`bulkDeleteByQuery` など）を先に呼ぶ（src/lib/crud/README.md「storage オプション」の FK cascade）。ユーザーの物理削除でも台帳を残すと決めた表だけは binding に `onHardDelete: "keep"` を指定して対象外にできる
2. 1 で FK を変えた場合: [user-run] `pnpm db:push`
3. 1 で FK を変えた場合: `pnpm db:push:check` が 0 statements を報告することを確かめる
4. storage オプション付きサービス（`storageBindingFor` を渡している drizzleBase.ts）に対する `replaceByQuery` 呼び出しを `grep -rn "replaceByQuery" src` で洗い出し、新しく 400 になる入力を送っていないか確かめる: (a) 同じ ref / URL を新しい行の 2 か所に入れる（共有は storageObjectService.copy で複製する）(b) 論理削除の表で、置き換える前の行のファイルを新しい行に入れる (c) 他人の ref・旧 URL など create で拒否される値を新しく入れる。該当があれば呼び出し側を直す
5. `storageBindingFor` を使わず CrudStorageBinding を自作している fork は、`afterReplace` を実装する（無いと、そのサービスの replaceByQuery は常に 400）。StorageLedger を自作している fork は `rebind` を実装する（types.ts のインターフェースに追加された）
verify: `pnpm test:storage-purposes` と `pnpm test:storage-object` が通る | `pnpm typecheck` が通る | 4 で直した呼び出しがあれば、その画面・API で置き換えが成功し、台帳（storage_objects）の record_id が新しい行を指すことを確かめる
manual_steps: -
refs: src/lib/crud/storageIntegration/applyStorageBinding.ts, src/lib/crud/storageIntegration/types.ts, src/features/core/storageObject/services/server/crudBinding.ts, src/features/core/storageObject/services/server/storageObjectService.ts (rebind), src/lib/crud/README.md「storage オプション」, src/features/core/storageObject/README.md, scripts/registry/check-storage-purposes.test.mjs
notes: storage オプションを持たないサービスの replaceByQuery は何も変わらない（ラップされない）。論理削除の表で records がメディア列に触れない呼び出しは素通しのまま。物理削除の表では、メディア列に触れない呼び出しでも旧行を FOR UPDATE で読み、消えた行の ref を record_removed にする。上流の既存の cascade（bankTransferReview の 2 本）はテスト内の STORAGE_CASCADE_EXCEPTIONS で例外扱い（fork はここに自分の表を足さず、1 の手順で直す）。fork の実態は not checked
