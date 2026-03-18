# 通知画像ディレクトリ

システム通知に自動挿入される画像を配置するディレクトリ。
画像が存在すれば自動的に通知の `image` フィールドにセットされる。存在しなければ画像なし。

## 命名規則

**パターン**: `{候補キー}.{拡張子}`

対応拡張子: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`（この優先順で探索）

### フォールバックチェーン

リゾルバに渡された候補キーの配列を先頭から順に探索し、最初に見つかった画像を使用する。
全て見つからなければ `default.{ext}` をフォールバックとして探索する。

### ウォレット残高変更通知の例

候補キー（優先順）:
1. `wallet-regular_coin-increment` — 通貨 + 操作 固有
2. `wallet-regular_coin` — 通貨 固有
3. `wallet` — ウォレット通知全般
4. `default` — 全通知共通フォールバック

### その他の通知での命名例

```
purchase-regular_coin.png    ← 購入通知（コイン固有）
purchase.png                 ← 購入通知全般
rank_up.png                  ← ランクアップ通知
campaign.png                 ← キャンペーン通知
default.png                  ← 全通知共通フォールバック
```

## 使い方

1. このディレクトリに命名規則に従った画像を配置する
2. サーバーサービスから `resolveNotificationImage(["wallet-regular_coin", "wallet"])` を呼ぶ
3. 存在する画像のパスが返される（なければ `null`）

リゾルバ: `src/features/core/notification/services/server/notification/resolveNotificationImage.ts`
