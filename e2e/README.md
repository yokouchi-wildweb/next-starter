# e2e — 実際のブラウザの受入のテスト

Playwright(`playwright.config.ts`、chromium・firefox・webkit)。ページは `src/app/e2e/**`(門番の規則 `e2eFixtures` が既定で閉じる = 本番では 404)。

## 走らせ方

1. 受入のページを開く: `src/config/app/app-features.config.ts` の `e2e.fixtures` を `true` にする(コミットしない。終わったら戻す)
2. dev server を立てる(エージェントは自分で立てない: 人か guild dev が立て、住所を受け取る)
3. `E2E_BASE_URL=http://localhost:<port> pnpm test:e2e:unsaved-guard`(1 つのブラウザだけ: `-- --project=chromium`)
4. `e2e.fixtures` を `false` に戻す

- CI だけ `webServer` で `pnpm dev` を立てる(`CI` があるとき)
- ブラウザの準備: `pnpm exec playwright install chromium firefox webkit`(webkit は OS のライブラリが要る)

## テスト

| ファイル | 中身 |
|---|---|
| `unsavedGuard.spec.ts` | 未保存の編集の守り(`src/lib/unsavedGuard`): 棚の Link・素の `<a>`・router.push・router.back・ブラウザの戻る / 進む・再読み込み・タブを閉じる × 留まる / 移る、送信は聞かない(firefox は 1 ページで 2 回目の beforeunload の確認を出さないことがあるので、再読み込みは留まる / 移るを別のテストにする) |
