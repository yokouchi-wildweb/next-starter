# demo — デモ(デモモード・デモのログイン・デモ利用者の管理)

表を持たない core ドメイン(設定の議会 D112)。デモ利用者の印は user の列 `is_demo`(user に残す)。

## 設定(`config.ts`、上書き `src/config/features/demo.config.ts`)

| 鍵 | 既定 | 読み手 |
|---|---|---|
| `mode.enabled` | `false` | proxy の項目 `src/proxies/demoMode.ts`(有効ならデモ利用者以外を `mode.redirectTo` へ転送) |
| `mode.allowedPaths` / `mode.allowedPrefixes` | `["/demo"]` / `["/_next", "/api", "/admin", "/assets"]` | 同上(完全一致 / 前方一致で転送しないパス。配列は丸ごと置き換え) |
| `mode.redirectTo` | `"/demo"` | 同上 |
| `session.maxAgeSeconds` | `600` | auth の `demoSessionMaxAgeSeconds`(デモのログインの機能 `demoLogin` が開のときだけ、閉なら通常の長さ) |
| `adminList.selectionTable` | `false` | user の `DemoUserList` の表(選択のテーブル) |

- `mode.enabled: true` はデモのページ(機能 `demoPages`)を要する: `featureRequirements` で宣言し、閉なら門 build の `pnpm check proxies` が止める
- 古い置き場との対応: proxies の demo テーマ(`src/proxies/demo/config.ts`・`src/config/proxies/demo.config.ts` の `enabled` ほか)→ `mode.<同じ鍵>`、`authConfig.session.demoMaxAgeSeconds` → `session.maxAgeSeconds`、`userConfig.userListPage.enableSelectionTable.demo` → `adminList.selectionTable`

## 入切

門番の規則 `demoPages`(/demo・/api/demo)・`demoLogin`(/demo-login・/api/auth/guest-login)・`adminDemoUsers`(/admin/users/demo、demoLogin に依存)が住所を閉じる。このフォルダはどの規則の `domains` にも載らない基盤(常に開、ASK 5 = a): 表・汎用 API・cron を持たず、常時動く proxy の項目 demoMode が値を読むため。値の読み手はそれぞれ意味のある機能の入切を確かめる(demoMode = demoPages、auth のセッションの長さ = demoLogin、デモ利用者の一覧 = adminDemoUsers)。

## まだ外にあるもの

デモのログインのサービス・hook・画面・API、デモ利用者の一覧と作成は auth・user にある(次の指令でここへ集める)。
