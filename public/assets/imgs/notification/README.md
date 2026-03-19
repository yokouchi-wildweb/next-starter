# 通知画像ディレクトリ

システム通知に自動挿入される画像を配置するディレクトリ。
画像が存在すれば自動的に通知の `image` フィールドにセットされる。存在しなければ画像なし。

## 配置規則

### パターン

フォルダで階層を分け、末尾セグメントをファイル名にする。すべて **kebab-case** で統一。

```
{segment1}/{segment2}/.../{segmentN}.{ext}
```

- **セグメント区切り**: ディレクトリ（`/`）
- **ファイル名**: 末尾セグメント（`index` ではない）
- **命名規則**: すべて kebab-case（resolver が snake_case, camelCase, UPPER_CASE を自動正規化）
- 対応拡張子（優先順）: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`

### フォールバックチェーン

リゾルバはセグメント列から候補を自動生成し、具体→汎用の順に探索する。

```typescript
resolveNotificationImage({ segments: ["wallet", "regular_coin", "INCREMENT"] })
```

生成される候補チェーン:
1. `wallet/regular-coin/increment` — 最も具体的（ディレクトリ + ファイル名）
2. `wallet/regular-coin` — カテゴリ直下のファイル
3. `wallet` — カテゴリのみ
4. `default` — 全通知共通フォールバック（自動付与）

### 配置例

```
notification/
  wallet/
    regular-coin/
      increment.png       ← コイン増加通知 固有
      decrement.png       ← コイン減少通知 固有
    regular-coin.png      ← コイン通知全般フォールバック
    premium-coin.png      ← プレミアムコイン通知全般
  wallet.png              ← ウォレット通知全般フォールバック
  purchase/
    regular-coin.png      ← コイン購入通知
  rank-up.png             ← ランクアップ通知
  campaign.png            ← キャンペーン通知
  default.png             ← 全通知共通フォールバック
```

## 使い方

1. このディレクトリに配置規則に従って画像を置く
2. サーバーサービスからセグメント列でリゾルバを呼ぶ
3. 存在する画像のパスが返される（なければ `null`）

```typescript
import { resolveNotificationImage } from "@/features/notification/services/server/notification/resolveNotificationImage";

// セグメント列 — DB値やコード上の定数をそのまま渡せる（kebab-case に自動正規化）
const image = resolveNotificationImage({ segments: ["wallet", "regular_coin", "increment"] });

// 単一カテゴリ
const image = resolveNotificationImage({ segments: ["rank_up"] });
```

リゾルバ: `src/features/core/notification/services/server/notification/resolveNotificationImage.ts`
