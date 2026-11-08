# tests/e2e/unsavedGuard — 未保存の編集の守りの受入のテスト

実際のブラウザ(Playwright、chromium・firefox・webkit)で、未保存の編集の守り(`src/lib/unsavedGuard`)を**実際の画面**で確かめる: 管理のサンプルタグ編集(フォーム)・デモの表 `/demo/tables`(EditableGridTable)・管理のサンプル一覧のデータの取り込み・管理のサンプルの並び替え(SortableList)。テストだけのルートは作らない(実際の画面で作れない場合はルートを足さず、上流で扱いを決める)。

## 置き場と設定(受入のテスト全体の約束)

- 受入のテストは `tests/e2e/<機能>/`(spec とこの README を同じフォルダに置く)
- 上流の設定は `playwright.config.default.ts`(`testDir: tests/e2e`)。上流は素の `playwright.config.ts` を出さない: 素の名前は fork の物(D171 の `.default` と素の組)。fork は自分の `playwright.config.ts` で `.default` を読んで足す(自分の spec の置き場・ブラウザなど)
- 上流の `package.json` の `e2e`(`pnpm e2e`)は `-c playwright.config.default.ts` で上流の設定を指す
- 画面を閉じる門番の規則が閉じている間は spec が理由を出して skip する(`tests/e2e/featureGate.ts` の `skipWhileClosed("<規則>")`、この spec は `sampleDomain` と `demoPages`。除外の一覧は持たない)。読むのはこのリポの規則の値(runner の側。サーバーには聞かない)
- ログインは `pnpm workflow dev-admin run` の管理者(開発用 DB)。パスワードは env ファイル(`ENV_FILE`、既定 `.env.development`)の `AUTH_JWT_SECRET` から dev-admin と同じ式で出す。ログインには回数の上限(15 分に 5 回)があるので、cookie を OS の一時フォルダに置き 30 分使い回す。サーバーに届かない・ログインできない・行が足りないときは理由を出して skip する
- データは開発用 DB のサンプル(変えてよい): 送信はサンプルタグの名前を、表の書きかけはサンプルの名前を書き換える。取り込みは同じ画面でエクスポートした ZIP を使い、要求は止めたまま中止する(サーバーに届かない)。取り込みと並び替えの保存待ちは、API の応答を `page.route` で止めて作る

## 走らせ方

1. `pnpm workflow dev-admin run`(確認用の管理者を用意する。何度打ってもよい)
2. dev server を立てる(`pnpm workflow dev-tab run`。`scripts/workflow/dev-tab/README.md`)
3. `E2E_BASE_URL=http://localhost:<port> pnpm e2e tests/e2e/unsavedGuard`
   - 1 つのブラウザだけ: `E2E_BASE_URL=… pnpm exec playwright test -c playwright.config.default.ts tests/e2e/unsavedGuard --project=chromium`(`pnpm e2e tests/e2e/unsavedGuard -- --project=…` では絞れない)

- CI だけ `webServer` で `pnpm dev` を立てる(`CI` があるとき)
- ブラウザの準備: `pnpm exec playwright install chromium firefox webkit`(webkit は OS のライブラリが要る)
- 結果のフォルダ `test-results/`・`playwright-report/` は `.gitignore` 済み

## テスト

| ファイル | 中身 |
|---|---|
| `unsavedGuard.spec.ts` | フォーム(サンプルタグ編集): 棚の Link(サイドバー)・router.push(前後の項目へ移る ItemNavigator)・ブラウザの戻る × 留まる / 移る、進む、再読み込み・タブを閉じる(beforeunload)、送信は聞かない(firefox は 1 ページで 2 回目の beforeunload の確認を出さないことがあるので、再読み込みは留まる / 移るを別のテストにする)。表(デモの EditableGridTable)の書きかけ × 戻る(留まる / 移る)・再読み込み。取り込み中 × 棚の Link(「処理の途中です」、留まると画面も取り込みの表示もそのまま。止めた要求は最後に中止するのでデータは変わらない)。並び替えの保存待ち × 棚の Link(保存が終われば聞かない) |
