# DOWNSTREAM NOTICE id:20261028-172612-collection-migration-guide
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-28T17:26:12+09:00
severity: info
checkpoint: collection-migration-guide
change: 既存の mediaUploaderMulti（主の表の text[] 列）の値を、主の集まり（従属ドメインの 1 枚 1 行）へ移す手順書を src/lib/crud/README.md のドメイン集約の章「既存の mediaUploaderMulti 列からの移行」に書いた（手順 0〜6・並びの鍵・やってはいけないこと 7 つ・旧 URL・移行の後の注意・戻し方）。コードの変更は無い
why: 前の notice 20261028-165213-owned-child-domain-collection が「既存の multi 列は取り込み後すぐ集まりへ移す。手順は後の notice のガイドラインで届ける」と約束していた。その手順書の場所を知らせる
required_actions:
1. 上流を merge する。必須の作業は無い
2. 既存の mediaUploaderMulti の項目を持つリポは、src/lib/crud/README.md「既存の mediaUploaderMulti 列からの移行」を読み、自分のリポで移行を計画する。要点: 基盤に移行の仕組みは無く、移行はそのドメインを持つリポが行う / 一度きりの移行は DB を直接 SQL で操作する（サービス経由の保存は binding がファイルを消す経路に当たる）/ 移行の間は主と従属への書き込みを止める / 手順 3 で作る移行の記録の表は登録表に無いので、在る間に pnpm db:push を流すとその表の DROP を提案される（N にする）/ 元の列を空にする・落とす（手順 5）の後は戻せない
3. 移行はこの notice の適用の中ではしない（データに触れる作業なので、リポごとに計画して人が承認してから行う）
verify: 移行を行ったリポは、手順書の手順 6（読み取りの SQL の数え上げ: 移行で作った従属の行数 = 元の列の要素数の合計、付け替えた台帳の件数、元の列を指したままの ready が 0、未紐付けの ready が増えていない）を pnpm db:query で確かめる。merge だけなら `pnpm typecheck` `pnpm lint` が通る（コードの変更なし）
manual_steps: -
refs: src/lib/crud/README.md「既存の mediaUploaderMulti 列からの移行」, src/features/README.md「主の集まりの項目（mediaCollection）」, .notices/20261028-165213-owned-child-domain-collection.md
notes:
- 掃除（storage-sweep）に空実行は無い。`pnpm task storage-sweep` は本実行なので、移行の確かめには使わない
- 手順書の SQL は形を示す例（プレースホルダ）で、upstream では流していない。各リポのデータで件数の照合（UPDATE の件数 = storage:// の要素数）が合わなければ TX を巻き戻してその行を調べる
- 63 件以上の要素を持つ主の行があるときは、並びの鍵を SQL で組まず、Node のワンショットで lib の generateInitialSortKeys を呼んで作る（手順書の「並びの鍵」）
- 削除・移動なし
- fork の状態: not checked（どの fork がどの multi 項目を持つかは各リポで数える）
