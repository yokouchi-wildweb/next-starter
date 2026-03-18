# 通知画像ディレクトリ

システム通知に自動挿入される画像を配置するディレクトリ。
画像が存在すれば自動的に通知の `image` フィールドにセットされる。存在しなければ画像なし。

## 命名規則

### ファイル名パターン

`{category}-{sub1}-{sub2}.{ext}`

- **カテゴリ区切り**: ハイフン（`-`）
- **DB由来の値**: snake_case をそのまま使用（例: `regular_coin`, `admin_action`）
- **固有の名前**: snake_case を推奨（例: `rank_up`, `campaign`）

対応拡張子（優先順）: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`

### 構造化入力とフォールバックチェーン

リゾルバは構造化入力から候補チェーンを自動生成し、具体→汎用の順に探索する。

```typescript
resolveNotificationImage({ category: "wallet", sub1: "regular_coin", sub2: "increment" })
```

生成される候補チェーン:
1. `wallet-regular_coin-increment` — カテゴリ + sub1 + sub2（最も具体的）
2. `wallet-regular_coin` — カテゴリ + sub1
3. `wallet` — カテゴリのみ
4. `default` — 全通知共通フォールバック（自動付与）

### 命名例

| ファイル名 | 用途 |
|---|---|
| `wallet-regular_coin-increment.png` | コイン増加通知 固有 |
| `wallet-regular_coin.png` | コイン通知全般 |
| `wallet.png` | ウォレット通知全般 |
| `purchase-regular_coin.png` | コイン購入通知 |
| `purchase.png` | 購入通知全般 |
| `rank_up.png` | ランクアップ通知 |
| `campaign.png` | キャンペーン通知 |
| `default.png` | 全通知共通フォールバック |

## 使い方

1. このディレクトリに命名規則に従った画像を配置する
2. サーバーサービスから構造化入力でリゾルバを呼ぶ
3. 存在する画像のパスが返される（なければ `null`）

```typescript
import { resolveNotificationImage } from "@/features/notification/services/server/notification/resolveNotificationImage";

// 構造化入力（推奨）
const image = resolveNotificationImage({ category: "wallet", sub1: "regular_coin", sub2: "increment" });

// カテゴリのみ
const image = resolveNotificationImage({ category: "rank_up" });

// 配列で直接指定（後方互換）
const image = resolveNotificationImage(["purchase-regular_coin", "purchase"]);
```

リゾルバ: `src/features/core/notification/services/server/notification/resolveNotificationImage.ts`
