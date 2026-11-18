# aiVision

## Overview

- Anthropic Claude Vision を使った画像の事前判定ユーティリティ。入口は `@/lib/aiVision`(閉じた lib、`libs: ["ai"]`)
- `checkBankTransferReceipt`: ユーザーが銀行振込の証拠としてアップロードした画像が、振込明細写真またはネットバンク振込完了画面に見えるかを判定する
  - 通常モード: 人間のレビュー前段で「明らかに無関係な画像」を弾くための仮判定。金額や振込先名の一致までは見ない
  - ストリクトモード(`strict` を渡す): 明細らしく、かつ明細内で振込人名・名前の前後の識別数字・振込金額の 3 点すべてが確認できたときだけ `isLikelyBankTransfer=true`(モデルが true でも 3 点のどれかが落ちればコードで false)。個別の合否は `strictChecks`
- 使う時・直す時の決まりは札 .claude/rules/items/lib/aiVision.md にある

## Usage

```ts
import { checkBankTransferReceipt } from "@/lib/aiVision";

const result = await checkBankTransferReceipt({
  imageBase64: "...", // data URL プレフィックスなし
  mediaType: "image/jpeg",
  // strict: { expectedIdentifier: "12345678", expectedAmount: 10000 }, // ストリクトモード
});

// result.isLikelyBankTransfer: boolean
// result.confidence: 0-100
// result.imageType: "photo" | "screenshot" | "other"
// result.reason: 判定根拠の日本語短文
// result.strictChecks: ストリクトモードのときだけ
```

## API

- 入力 `CheckBankTransferReceiptInput`: `imageBase64`(data URL プレフィックスなし)/ `mediaType`(`SupportedImageMediaType`)/ `strict?`(`BankTransferStrictExpectation`: `expectedIdentifier` = 振込人名の前後どちらかに付く数字 8 桁、`expectedAmount` = 一致すべき振込金額(円))
- 結果 `CheckBankTransferReceiptResult`: `isLikelyBankTransfer` / `confidence`(0-100)/ `imageType`(`BankTransferReceiptImageType`)/ `reason` / `strictChecks?`
- `BankTransferStrictChecks`: `senderNameConfirmed` / `identifierConfirmed` / `amountConfirmed` / `detectedSenderName`
- 投げる: Anthropic API のエラー / `ANTHROPIC_API_KEY` 未設定 / 応答に `tool_use` が無い・形が想定外(ストリクトで 3 点の欄が欠けたときも)

## Internals

- モデル: `claude-haiku-4-5-20251001` 固定(`bankTransferReceipt.ts` の `MODEL`)
- structured output: Tool use で JSON Schema を強制し、自由文返却によるパース失敗を無くしている
- server only: `import "server-only"` でクライアントバンドルへの混入を防ぐ(API キーをクライアントに出さない)
- 遅延初期化: `ANTHROPIC_API_KEY` 未設定でもモジュールの import は通り、実行時に明示エラー
- プロンプトは `prompts.ts`(通常モードとストリクトモード。ストリクトは「確認できなければ落とす」方針)

## Verification

- 環境変数 `ANTHROPIC_API_KEY`: 必須。`.env.development` に設定
- サンドボックス: `/demo/bank-transfer-vision` で任意画像の判定を試せる
- 接続の確認: `pnpm ops claude test`
