# demo — デモ(デモモード・デモのログイン・デモ利用者の管理)

表を持たない core ドメイン(設定の議会 D112)。デモ利用者の印は user の列 `is_demo`(user に残す)。

## 設定(`config.ts`、上書き `src/config/features/demo.config.ts`)

| 鍵 | 既定 | 読み手 |
|---|---|---|
| `mode.enabled` | `false` | proxy の項目 `src/proxies/demoMode.ts`(有効ならデモ利用者以外を `mode.redirectTo` へ転送) |
| `mode.allowedPaths` / `mode.allowedPrefixes` | `["/demo"]` / `["/_next", "/api", "/admin", "/assets"]` | 同上(完全一致 / 前方一致で転送しないパス。配列は丸ごと置き換え) |
| `mode.redirectTo` | `"/demo"` | 同上 |
| `session.maxAgeSeconds` | `600` | auth の `demoSessionMaxAgeSeconds`(デモのログインの機能 `demoLogin` が開のときだけ、閉なら通常の長さ) |
| `adminList.selectionTable` | `false` | `components/DemoUserList` の表(選択のテーブル) |

- `mode.enabled: true` はデモのページ(機能 `demoPages`)を要する: `featureRequirements` で宣言し、閉なら門 build の `pnpm check proxies` が止める
- 古い置き場との対応: proxies の demo テーマ(`src/proxies/demo/config.ts`・`src/config/proxies/demo.config.ts` の `enabled` ほか)→ `mode.<同じ鍵>`、`authConfig.session.demoMaxAgeSeconds` → `session.maxAgeSeconds`、`userConfig.userListPage.enableSelectionTable.demo` → `adminList.selectionTable`

## 入切

門番の規則 `demoPages`(/demo・/api/demo)・`demoLogin`(/demo-login・/api/demo-login)・`adminDemoUsers`(/admin/users/demo、demoLogin に依存)が住所を閉じる。このフォルダはどの規則の `domains` にも載らない基盤(常に開、ASK 5 = a): 表・汎用 API・cron を持たず、常時動く proxy の項目 demoMode が値を読むため。値の読み手はそれぞれ意味のある機能の入切を確かめる(demoMode = demoPages、auth のセッションの長さ = demoLogin、デモ利用者の一覧 = adminDemoUsers)。

## 中身

```
demo/
├── config.ts                      # demoConfig(上の表)
├── constants/index.ts             # DEMO_USER_ID_KEY(同じブラウザで同じデモ利用者に戻る localStorage のキー)
├── services/
│   ├── server/demoLogin.ts        # demoLogin: 覚えた ID のデモ利用者か新しいデモ利用者でセッションを発行する
│   ├── server/onDemoUserCreated.ts          # 1 行スイッチ(fork の実装は隣の onDemoUserCreated.replace.ts に向ける)
│   ├── server/onDemoUserCreated.default.ts  # 既定 = 何もしない(新しいデモ利用者に関連の行を足す受け口)
│   └── client/demoLogin.ts        # POST /api/demo-login を呼ぶ ClientService
├── hooks/useDemoLogin.ts          # /demo-login の画面が呼ぶ hook
└── components/DemoUserList/       # /admin/users/demo の一覧(入口 components/index.ts)
```

- API: `POST /api/demo-login`(`src/app/api/demo-login/route.ts`、公開・レート制限のカテゴリ `guestLogin`)
- 画面: `/demo-login`(`src/app/(user)/(auth)/demo-login/`)・`/admin/users/demo`(`src/app/admin/(protected)/users/demo/`)

## ほかのドメインに残すもの

- デモ利用者の行を作る処理(`createGuestDemoUser`・管理の `createDemoUser`)と列 `is_demo` は user(users への書き込み・状態の履歴・名前の規則は user の持ち物)。demoLogin はそれを呼ぶ
- セッションの長さの部品 `demoSessionMaxAgeSeconds` とトークンの発行は auth(`services/server/session/sessionToken.ts`)
- 管理のデモ利用者の作成の画面(`DemoUserCreate`)は user の管理の部品
