# tests/e2e/unsavedGuard — 未保存の編集の守りの受入のテスト

実際のブラウザ(Playwright、chromium・firefox・webkit)で、未保存の編集の守り(`src/lib/unsavedGuard`)を確かめる。ページは `src/app/e2e/unsaved-guard/**`(門番の規則 `e2eFixtures` が既定で閉じる = 本番では 404)。

## 置き場と設定(受入のテスト全体の約束)

- 受入のテストは `tests/e2e/<機能>/`(spec とこの README を同じフォルダに置く)
- 上流の設定は `playwright.config.default.ts`(`testDir: tests/e2e`)。上流は素の `playwright.config.ts` を出さない: 素の名前は fork の物(D171 の `.default` と素の組)。fork は自分の `playwright.config.ts` で `.default` を読んで足す(自分の spec の置き場・ブラウザなど)
- 上流の `package.json` の `test:e2e:*` は `-c playwright.config.default.ts` で上流の設定を指す
- 門番の規則が閉じている間は spec が理由を出して skip する(`tests/e2e/featureGate.ts` の `skipWhileClosed("<規則>")`、除外の一覧は持たない)。読むのはこのリポの規則の値(runner の側。サーバーには聞かない)

## 走らせ方

1. 受入のページを開く: `src/config/app/app-features.config.ts` の `e2e.fixtures` を `true` にする(コミットしない。終わったら戻す)。閉じたまま走らせると全部 skip になり、理由が出る
2. dev server を立てる(エージェントは自分で立てない: 人か guild dev が立て、住所を受け取る)
3. `E2E_BASE_URL=http://localhost:<port> pnpm test:e2e:unsaved-guard`
   - 1 つのブラウザだけ: `E2E_BASE_URL=… pnpm exec playwright test -c playwright.config.default.ts tests/e2e/unsavedGuard --project=chromium`(`pnpm test:e2e:unsaved-guard -- --project=…` では絞れない)
4. `e2e.fixtures` を `false` に戻す

- CI だけ `webServer` で `pnpm dev` を立てる(`CI` があるとき)
- ブラウザの準備: `pnpm exec playwright install chromium firefox webkit`(webkit は OS のライブラリが要る)
- 結果のフォルダ `test-results/`・`playwright-report/` は `.gitignore` 済み

## テスト

| ファイル | 中身 |
|---|---|
| `unsavedGuard.spec.ts` | 棚の Link・素の `<a>`・router.push・router.back・ブラウザの戻る / 進む・再読み込み・タブを閉じる × 留まる / 移る、送信は聞かない(firefox は 1 ページで 2 回目の beforeunload の確認を出さないことがあるので、再読み込みは留まる / 移るを別のテストにする)。フォーム以外の使い手の行: 表の直接の編集(`EditableGridTable`)の書きかけ × 戻る(留まる / 移る)・再読み込み、保存待ち × 棚の Link(保存が終われば聞かない) |
