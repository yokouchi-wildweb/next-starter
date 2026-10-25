# DOWNSTREAM NOTICE id:20261025-164220-storage-cascade-check-warn
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-25T16:42:20+09:00
severity: action-required
checkpoint: storage-cascade-check-warn
change: pnpm test:storage-purposes の FK cascade 検査を失敗から警告に下げた（メディア列を持つ表の cascade を console.warn で並べるだけ）。テスト内の STORAGE_CASCADE_EXCEPTIONS と「除外リストに古い項目が残っていない」テストは削除。README / core ルールの「FK cascade (MANDATORY)」は推奨に変わった
why: 20261024-160000-storage-replace-by-query-cascade はメディア列を持つ表の cascade をテストで落とし、FK を restrict に変えて親の削除 wrapper を手書きさせていたが、fork の土台として重すぎた。メディア列を持つ表でも DB の onDelete cascade を許す決定になった。cascade で消えた行の紐付けは、後の notice で入る台帳の照合（storage-sweep）で片付ける。それまでは紐付けと実物が残るだけで、壊れはしない
required_actions:
1. cascade の FK はそのまま残す（restrict に変えない）
2. `pnpm test:storage-purposes` を実行し、通ることを確かめる。cascade を持つ fork の表は `[storage] メディア列を持つ表に FK onDelete cascade があります` の警告に並ぶ。これは想定どおりで、直す必要はない
3. 20261024-160000-storage-replace-by-query-cascade の旧版に従って、もう FK を restrict に変えた fork: そのままでよい（restrict + 子のサービスで削除する方法は、すぐ片付けたい場合の選択肢として残る）。cascade に戻したい場合だけ、FK を `onDelete: "cascade"` に戻して親の削除 wrapper から子の削除の呼び出しを外し、[user-run] `pnpm db:push` → `pnpm db:push:check` が 0 statements を報告することを確かめる（戻すかどうかは任意）
4. fork がテストに独自の cascade 例外リスト（STORAGE_CASCADE_EXCEPTIONS への追記など）を足していた場合は、上流の削除を採る（merge の衝突は上流版を採る）
verify: `pnpm test:storage-purposes` が通る | `pnpm typecheck` が通る
manual_steps: -
refs: scripts/registry/check-storage-purposes.test.mjs, src/lib/crud/README.md「storage オプション」(FK cascade), src/features/core/storageObject/README.md (FK cascade), .claude/rules/core/crud-service.md (media_fk_cascade), .notices/20261024-160000-storage-replace-by-query-cascade.md
notes: 応急処置。cascade 検査と service.storageCascadeForeignKeys の削除、台帳の照合（record_type → 表の対応による孤立した紐付けの片付け）、アプリ側の物理削除での子孫の detach、ユーザーの物理削除でのファイル（アバター含む）の片付けは、後の notice（db:push を伴う checkpoint）で出す。中間 Tier はこの notice を下流へ中継する（下流の fork も旧版の restrict 手順を踏まないように）。fork の状態: boardgame-site と oripa-do は 20261024-160000-storage-replace-by-query-cascade をまだ適用していない（両 fork の .notices/applied/ で確認済み。boardgame-site は posts.user_id / collections.user_id → users、oripa-do は prize_items に cascade がある）。その他の fork は not checked
