# DOWNSTREAM NOTICE id:20261028-235919-multi-media-removed-from-generator
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-28T23:59:19+09:00
severity: breaking
checkpoint: multi-media-removed-from-generator
change: 生成器から fieldType `mediaUploaderMulti`（1 列の text[] に複数のメディアを持つ型）を廃止した。dc:init / dc:add の選択肢・問い・生成の分岐（列・スキーマ・モデル・presenters・Fields）・用途の登録・語彙の検査から外し、domain.json に `"fieldType": "mediaUploaderMulti"` が残っていると dc:generate が「集まり（mediaCollection）へ移す」と案内する生成エラーで止まる（黙って捨てない）。複数のメディアは mediaCollection で持つ。formInput の `mediaUploaderMulti` は集まりの入力欄の名前として残る。sample から `gallery_images`（旧型の例）を消した（列が消える）。lib（src/lib/crud・src/lib/storage）の `multi: true` の binding と、フォーム部品の text[] の扱いは残している
why: 古いやり方を生成器に残すと、型・問い・生成の分岐・用途の登録・検査が 2 通りになる（評議会 20261024-173854-owned-child-domain-shape の決定 D36、片付けの段 b）
required_actions:
1. merge の前に、fork 独自の旧型の項目が無いことを確かめる: `grep -rln '"fieldType": "mediaUploaderMulti"' src/features --include=domain.json`（sample/domain.json は上流が直すので除く）。1 件でもあれば merge せずに止め、src/lib/crud/README.md「既存の mediaUploaderMulti 列からの移行」の手順で集まりへ移し終えてから取り込む（移行の手順 1 = 旧用途を storagePurposeRegistry.ts の FORK ブロックへ写す、を必ず含める。旧用途の登録が消えると、移した行のファイルが読めず消せなくなる）
2. 上流を merge する。fork が sample/domain.json を書き換えていて衝突したら、`gallery_images` の項目（fields と fieldGroups の media の行）を消した上流の形に合わせ、`pnpm dc:generate Sample --yes` で生成し直す
3. [user-run] pnpm db:push（`ALTER TABLE "samples" DROP COLUMN "gallery_images"` の 1 文。sample のデータなので捨ててよい。データ消失の確認が出る。`!` から実行するなら `pnpm db:push --force`）
4. 掃除で台帳を片付ける（notice 20261028-231216-storage-sweep-value-check の値の照合）: db:push の後に storage-sweep を走らせると、`reconcile.unreferenced` に `sample.gallery_images` の `column_missing` が出る（sample のギャラリーに画像を入れていた fork だけ）。他の表・列が出ていないことを確かめてから `valueCheck: "detach"` で片付ける。fork の方針で `"report"` のまま運用するなら、その間だけ `"detach"` にして 1 回走らせて戻す
5. `pnpm typecheck` `pnpm lint` を通す
verify: `pnpm typecheck` `pnpm lint` が通る | `pnpm db:push:check` が差分 0 | `grep -rn '"fieldType": "mediaUploaderMulti"' src/features --include=domain.json` が 0 件 | `pnpm test:form-defaults` `pnpm test:storage-purposes` が通る | storage-sweep の後、`pnpm db:query "select count(*) from storage_objects where status = 'ready' and purpose = 'sample.gallery_images'"` が 0
manual_steps: 本番・ステージングの DB でも手順 3 の db:push と、手順 4 の掃除（デプロイ後の storage-sweep の報告を見てから detach）を行う
refs: scripts/domain-config/checks/retiredFieldTypes.mjs, src/lib/crud/README.md「既存の mediaUploaderMulti 列からの移行」, src/features/README.md「主の集まりの項目（mediaCollection）」, scripts/domain-config/README.md, .notices/20261028-231216-storage-sweep-value-check.md, .notices/20261028-172612-collection-migration-guide.md
notes:
- checkpoint: 区切り。手順 4 は、先に出した値の照合の notice（20261028-231216）が適用済みであることが前提（同じ区間か、それより前の区間にある）
- 生成物: 旧型の項目が無い domain.json の生成物は変わらない（dc:parity で、88-base TriQ boardgame-site next-vnx oripa-demo oripa-do の domain.json に上流の sample を重ねて 35/35 一致）。生成するメディア列の storage binding は今と同じ `multi: false` を出す
- 上流（next-starter）の開発 DB では、db:push の後の掃除の報告で `sample.gallery_images` の column_missing 9 件が出て、detach で 9 件とも台帳から外れ実物も消えたことを確かめた
- 生成器の dc:parity の合成 fixture `album` から旧型の項目を外した。Firestore のメディア列のエラー文から旧型の名前を消した（生成エラーの文が変わる）
- fork の状態: sample 以外の `"fieldType": "mediaUploaderMulti"` は 88-base TriQ boardgame-site next-vnx oripa-demo oripa-do oripa-do-2 で 0 件（oripa-do の prizeItem.generic_images は移行済みで fieldType mediaCollection）。fork の手書きのコードに gallery_images の参照は無い（上流から取り込んだテストと lib のコメントだけ）
- 段 a（dc:init / dc:add の選択肢から外すだけの段、order 20261028-062014-multi-media-hide-from-questions）はこの notice に含めた（別の notice は出さない）
- 削除・移動なし。追加: scripts/domain-config/checks/retiredFieldTypes.mjs
