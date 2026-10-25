# DOWNSTREAM NOTICE id:20261024-160000-storage-replace-by-query-cascade
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-24T16:00:00+09:00
severity: action-required
checkpoint: storage-replace-by-query-cascade
change: createCrudService の storage オプションが replaceByQuery を台帳と連動させるようになった（attach / 付け替え / record_removed）。メディア列を持つ表の FK onDelete cascade の検出（pnpm test:storage-purposes）も入ったが、その FK に関する部分は 20261025-164220-storage-cascade-check-warn で置き換えた
why: これまで storage オプション付きサービスの replaceByQuery は台帳を通らず、挿入した ref は未採用のまま sweep に実物を消され、消した行の ref は紐付いたまま実物が漏れていた。修正に伴い replaceByQuery が新たに 400 を返す入力がある
required_actions:
1. FK は変えない（restrict に変える手順は取り下げた。20261025-164220-storage-cascade-check-warn を参照）。この区間の merge 時点の上流では `pnpm test:storage-purposes` の「storage オプション付きサービスは、親の削除で DB に消される FK を持たない」が fork の cascade の表を挙げて落ちることがある。想定どおりなので、FK を直さず次の区間へ進む（20261025-164220-storage-cascade-check-warn の区間でテストが警告に変わる）
2. storage オプション付きサービス（`storageBindingFor` を渡している drizzleBase.ts）に対する `replaceByQuery` 呼び出しを `grep -rn "replaceByQuery" src` で洗い出し、新しく 400 になる入力を送っていないか確かめる: (a) 同じ ref / URL を新しい行の 2 か所に入れる（共有は storageObjectService.copy で複製する）(b) 論理削除の表で、置き換える前の行のファイルを新しい行に入れる (c) 他人の ref・旧 URL など create で拒否される値を新しく入れる。該当があれば呼び出し側を直す
3. `storageBindingFor` を使わず CrudStorageBinding を自作している fork は、`afterReplace` を実装する（無いと、そのサービスの replaceByQuery は常に 400）。StorageLedger を自作している fork は `rebind` を実装する（types.ts のインターフェースに追加された）
verify: `pnpm test:storage-object` が通る（`pnpm test:storage-purposes` は 1 の cascade の項目以外が通る）| `pnpm typecheck` が通る | 2 で直した呼び出しがあれば、その画面・API で置き換えが成功し、台帳（storage_objects）の record_id が新しい行を指すことを確かめる
manual_steps: -
refs: src/lib/crud/storageIntegration/applyStorageBinding.ts, src/lib/crud/storageIntegration/types.ts, src/features/core/storageObject/services/server/crudBinding.ts, src/features/core/storageObject/services/server/storageObjectService.ts (rebind), src/lib/crud/README.md「storage オプション」, src/features/core/storageObject/README.md, scripts/registry/check-storage-purposes.test.mjs
notes: superseded (FK 部分) by 20261025-164220-storage-cascade-check-warn; do not convert FKs to restrict。DB の onDelete cascade はメディア列を持つ表でも許す決定になり、cascade の検出は警告に下げた（fork がこの notice の旧版に従って restrict に変えた場合の扱いは 20261025-164220-storage-cascade-check-warn）。storage オプションを持たないサービスの replaceByQuery は何も変わらない（ラップされない）。論理削除の表で records がメディア列に触れない呼び出しは素通しのまま。物理削除の表では、メディア列に触れない呼び出しでも旧行を FOR UPDATE で読み、消えた行の ref を record_removed にする。fork の実態は not checked
