# demo — デモ(デモモード・デモのログイン・デモ利用者の管理)

## Overview

- デモモード・デモのログイン・管理画面のデモ利用者の一覧を持つ、表を持たない core ドメイン。デモ利用者の印は user の列 `is_demo`(user に残す)
- 使う時・直す時の決まりは札 .claude/rules/items/domains/demo.md にある。この README は使い方と仕組み

## API

- `demoConfig`(`config.ts`): 下の Extension の表の値
- `DEMO_USER_ID_KEY`(`constants`): 同じブラウザで同じデモ利用者に戻るための localStorage のキー
- server `demoLogin`(`services/server/demoLogin.ts`): 覚えた ID のデモ利用者か新しいデモ利用者でセッションを発行する
- server `onDemoUserCreated`(`services/server/onDemoUserCreated.ts`): 新しいデモ利用者に関連の行を足す受け口。既定(`.default.ts`)は何もしない
- client: `demoLogin`(POST `/api/demo-login`)・`bankTransferVision`(POST `/api/demo/bank-transfer-vision`、振込明細画像の判定デモ。入力と応答の型は `types/bankTransferVision.ts`)
- hooks: `useDemoLogin`(/demo-login の画面)・`useBankTransferVisionDemo`(/demo/bank-transfer-vision の画面。結果・読み込み中・エラーの文言)
- 部品: `DemoUserList`(/admin/users/demo の一覧、入口 `components/index.ts`)
- API ルート: `POST /api/demo-login`(`src/app/api/demo-login/route.ts`、公開・レート制限のカテゴリ `guestLogin`)
- 画面: `/demo-login`(`src/app/(user)/(auth)/demo-login/`)・`/admin/users/demo`(`src/app/admin/(protected)/users/demo/`)

## Extension

設定は `config.ts`、上書きは `src/config/domains/demo.config.ts`。

| 鍵 | 既定 | 読み手 |
|---|---|---|
| `mode.enabled` | `false` | proxy の項目 `plugs/proxyHandlers/demoMode.ts`(有効ならデモ利用者以外を `mode.redirectTo` へ転送) |
| `mode.allowedPaths` / `mode.allowedPrefixes` | `["/demo"]` / `["/_next", "/api", "/admin", "/assets"]` | 同上(完全一致 / 前方一致で転送しないパス) |
| `mode.redirectTo` | `"/demo"` | 同上 |
| `session.maxAgeSeconds` | `600` | auth の `demoSessionMaxAgeSeconds`(デモのログインの機能 `demoLogin` が開のときだけ、閉なら通常の長さ) |
| `adminList.selectionTable` | `false` | `components/DemoUserList` の表(選択のテーブル) |

- 新しいデモ利用者に行を足すときは `onDemoUserCreated` を 1 行スイッチで fork の `onDemoUserCreated.replace.ts` に向ける(形: `scripts/structure/extensions/README.md`)

## Internals

### 入切

- 門番の規則 `demoPages`(/demo・/api/demo)・`demoLogin`(/demo-login・/api/demo-login)・`adminDemoUsers`(/admin/users/demo、demoLogin に依存)が住所を閉じる
- このフォルダはどの規則の `domains` にも載らない常設(常に開): 表・汎用 API・cron を持たず、常時動く proxy の項目 demoMode が値を読むため
- 値の読み手はそれぞれ、その値に意味を与える機能の入切を確かめている(demoMode = demoPages、auth のセッションの長さ = demoLogin、デモ利用者の一覧 = adminDemoUsers)

### ほかのドメインに残すもの

- デモ利用者の行を作る処理(`createGuestDemoUser`・管理の `createDemoUser`)と列 `is_demo` は user(users への書き込み・状態の履歴・名前の規則は user の持ち物)。demoLogin はそれを呼ぶ
- セッションの長さの部品 `demoSessionMaxAgeSeconds` とトークンの発行は auth(`services/server/session/sessionToken.ts`)
- 管理のデモ利用者の作成の画面(`DemoUserCreate`)は user の管理の部品
