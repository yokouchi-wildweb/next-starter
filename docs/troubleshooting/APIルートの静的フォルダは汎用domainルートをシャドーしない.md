# APIルートの静的フォルダは汎用 [domain] ルートをシャドーしない

> 結論だけ先に: `/api/<domain>/` に独自の静的サブルート（例 `/api/coupon/redeem`）があっても、
> 汎用 `/api/[domain]/**`（generic CRUD）は**普通に動く**。「静的フォルダが汎用ルートを覆い隠して
> 404 になる」というのは**誤解**。この誤解に基づく対策（ミラールート追加等）は不要。

## 何が誤解されやすいか

「`/api/setting/setup` のような静的フォルダがあると、Next.js が静的 `setting` を優先して
`/api/setting/global` を `/api/[domain]/[id]` にフォールバックさせず 404 になる」——これは**起きない**。

## なぜ動くのか（Next.js の解決仕様）

Next.js App Router は**フルパス単位でルートをマッチング**する。静的セグメントは
**完全一致するパスだけ**を占有する。

- `/api/coupon/redeem` → 静的 `coupon/redeem` にマッチ（静的が勝つ）
- `/api/coupon/<id>` / `/api/coupon/search` / `/api/coupon/count` → `coupon/` 配下に一致する静的パスが
  無いので、素直に `/api/[domain]/[id]`・`/api/[domain]/search` … にマッチする

`/api/users/[id]` と `/api/users/export` が同居できるのと同じ理屈。静的サブルートを持つドメインでも、
generic client CRUD（`createApiClient("/api/<domain>")` の getById/update/search 等）はそのまま機能する。

## 実機での確認方法（前提を鵜呑みにせず必ずこれで確定する）

dev サーバーに未認証で `curl -i` を投げ、**ステータスと content-type**で判定する:

- `401` / `403` の JSON（例 `{"message":"認証が必要です。"}`）
  → **汎用ルートに到達**している（＝シャドーされていない）。認可で弾かれているだけ。
- `404` かつ `content-type: text/plain`（本文 `Not Found`）
  → `/api/[domain]` ハンドラに到達したが、そのドメインが serviceRegistry 未登録。
- `404` かつ `content-type: text/html`（Next の 404 ページ）
  → これが**本物のルーティング欠落**。静的フォルダ持ちドメインの汎用パスでこれが出ることは無い。

```
# 例: 静的フォルダを持つ setting/coupon/wallet でも汎用パスは 401（＝到達）
curl -i http://localhost:3000/api/setting            # 401 JSON
curl -i http://localhost:3000/api/setting/global      # 401 JSON
curl -i -X POST http://localhost:3000/api/coupon/count  # 401 JSON
```

## 関連する“本物の”落とし穴: setting が client で読めない

`useSetting()` = `settingClient.getById("global")` = `/api/setting/global` は
**serviceRegistry で setting が `ADMIN_ONLY`** のため、非管理者コンテキストからは `401`。
その結果 `!setting` になり「トグルが無効のまま」等の症状が出る。これは**ルーティングではなく
アクセス制御**の問題。表示用の設定を非管理者に読ませたい場合は、admin 専用の `useSetting()` ではなく
**非管理者向けの読み取り経路**（公開/認証ユーザー向けのカスタムルート）を用意して読む。

## 教訓

- 「症状」は信じてよいが、「原因の断定（例: シャドーイングだ）」は**自分で最小再現して検証**するまで
  事実として扱わない。特に大規模・構造的な変更に着手する前は必須。
- ルーティング挙動は上記 `curl` で数十秒で確定できる。憶測で実装を広げない。
