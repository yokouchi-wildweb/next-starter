# dataMigration の storage 切り替え 画面確認（2026-10-23）

legate 指令 14（N2 T10 の残り）。worktree（legate ブランチ）の開発サーバー（localhost:3000、試験バケット）で、/admin/samples の「ファイル入出力」を Playwright（Chromium）で操作した。目視の表示確認は人。

## 手順と結果
1. export: sample「dm-export-check」をメイン 1 枚・ギャラリー 2 枚（ref）で作成 → 画像を含めて export
   - ZIP に `assets/main_image/<id>.png`、`assets/gallery_images/<id>_1.png` / `<id>_2.png`。旧 URL の行の画像も同梱
   - manifest の mediaSkipped は 0 件、警告トーストなし
2. import: 1 の ZIP をそのまま import → 13 件、失敗チャンク 0
   - 画像列の 8 値がすべて新しい ref（ready・業務行に紐付き・所有者 admin）。dm-export-check の元の ref 3 件は deleted（replaced）
   - 既存 4 行（旧 URL だった行）の画像は新しい ref に置き換わった。旧ファイルは残る
3. 旧 URL の CSV（手作りの ZIP、旧バケットに実在する firebasestorage URL をメインとギャラリーに）→ 成功
   - メイン・ギャラリーとも copy で新しい ref（1590 バイト・所有者 admin・紐付き）。旧ファイルは 200 / 1590 バイトのまま
4. 外部 URL の CSV（正しい行 + `https://example.com/a.png` の行）→ 失敗チャンク 1
   - 表示: 「chunk_001: データ行 2: main_image: 取り込めない値です…（値: https://example.com/a.png）」
   - 2 行とも DB に無い（チャンク全体が巻き戻る）
5. 目視（人）: 一覧と詳細でメイン画像・ギャラリーが表示される → OK

## 備考
- 試験バケットの CORS が `http://localhost:3000` だけのため、worktree の開発サーバーは 3000 で動かした（本体の開発サーバーは止めた）
- 確認用の画像と ZIP は commit していない
