# aiVision - 画像AI判定ライブラリ

Anthropic Claude Vision を使った画像の事前判定ユーティリティ。

## 提供API

### `checkBankTransferReceipt`

ユーザーが銀行振込の証拠としてアップロードした画像が、振込明細写真またはネットバンク振込完了画面に見えるかをざっくり判定します。

人間のレビュー前段で「明らかに無関係な画像」を弾くための仮判定用途です。金額や振込先名の一致までは検証しません。

```ts
import { checkBankTransferReceipt } from "@/lib/aiVision";

const result = await checkBankTransferReceipt({
  imageBase64: "...", // data URL プレフィックスなし
  mediaType: "image/jpeg",
});

// result.isLikelyBankTransfer: boolean
// result.confidence: 0-100
// result.imageType: "photo" | "screenshot" | "other"
// result.reason: 判定根拠の日本語短文
```

## 設計メモ

- **モデル**: `claude-haiku-4-5-20251001` 固定。精度不足なら `bankTransferReceipt.ts` の `MODEL` を Sonnet 4.6 等に差し替え。
- **structured output**: Tool use で JSON Schema を強制し、自由文返却によるパース失敗を排除。
- **server only**: `import "server-only"` でクライアントバンドルへの混入を防止。API キーをクライアントに漏らさないため。
- **遅延初期化**: ANTHROPIC_API_KEY 未設定でもモジュール import 自体は通る。実行時に明示エラー。

## 環境変数

- `ANTHROPIC_API_KEY`: 必須。`.env.development` に設定。

## サンドボックス

`/demo/bank-transfer-vision` で任意画像の判定を試せます。
