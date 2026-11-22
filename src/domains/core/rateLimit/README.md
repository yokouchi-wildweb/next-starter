# rateLimit - レート制限

## Overview

- IP アドレスなどの識別子ごとのリクエスト制限。スパム登録や過剰アクセスを防ぐ
- 制限はカテゴリ(窓の秒数と上限回数)ごと。上流のカテゴリと既定値は `config.ts`
- 入切の機能を持たない(門番の規則なし、常に開)
- 使う時・直す時の決まりは札 .claude/rules/items/features/rateLimit.md にある。この README は使い方と仕組み

## Usage

### API ルートに当てる

`createApiRoute` の `rateLimit` オプションにカテゴリ名を書く。同じ IP からのリクエストが制限される:

```ts
export const POST = createApiRoute(
  {
    operation: "POST /api/example",
    operationType: "write",
    rateLimit: "apiGeneral",  // ← カテゴリ名を指定
  },
  async (req) => { ... }
);
```

- 識別子は `readClientIp` で読んだ IP(読めなければ `"unknown"`)
- `rateLimitSubnet: "<カテゴリ>"` = IP の上位 3 オクテット(/24)を識別子にする。IP が散らばる送り手(iCloud Private Relay 等)に効く。`rateLimit` と並べて書ける

### 値を変える・カテゴリを足す

上書き `src/config/domains/rateLimit.config.ts` で値を変え、自分のカテゴリを足す(足す名前は `Extra` 型で宣言する。値はリテラル):

```ts
// src/config/domains/rateLimit.config.ts
import type { RateLimitOverride, RateLimitRule } from "@/domains/rateLimit/config";

export type Extra = { winReportVerify: RateLimitRule };

export default {
  login: { maxRequests: 10 }, // 上流のカテゴリの値を変える
  winReportVerify: { windowSeconds: 300, maxRequests: 5 }, // 自分のカテゴリ(5 分に 5 回)
} satisfies RateLimitOverride<Extra>;
```

### 識別子を変える(ルートの外から直接数える)

```ts
// ユーザー単位: ルートの ctx.user の userId を識別子にする
const result = await checkRateLimit("apiGeneral", user.userId);

// IP とエンドポイントの組み合わせ
const result = await checkRateLimit("apiGeneral", `${ip}:/api/specific`);
```

## API

### カテゴリの値(`RateLimitRule`)

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `windowSeconds` | number | 制限ウィンドウの秒数 |
| `maxRequests` | number | ウィンドウ内の最大リクエスト数 |

- `RateLimitCategory` = 上流のカテゴリ + 上書きの `Extra` の名前。route の `rateLimit: "<名前>"` に知らない名前を書くと型で落ちる

### ヘルパー関数(`services/server/wrappers/rateLimitHelper.ts`)

- `checkRateLimit(category, identifier)`: 制限を確かめてカウントを増やす → `{ allowed: boolean, remaining: number, resetAt: Date, count: number }`
- `getRateLimitStatus(category, identifier)`: 今の状態を返す(カウントは増やさない)
- `cleanupExpiredRateLimits()`: 期限切れの行を消す(定期に呼ぶ用。上流には呼ぶタスクが無い)
- `checkRateLimit` は数えた後の値が `maxRequests` に届いた時点で拒むので、窓の中で通るのは `maxRequests - 1` 回

銀行振込の画像の判定専用(`services/server/wrappers/judgmentRateLimit.ts`、識別子は userId):

- `checkJudgmentRateLimit(userId)`・`recordAttempt(userId)`・`recordFailure(userId)`・`getJudgmentRateLimitStatus(userId)`
- 直近 15 分の失敗 3 回(`LIMIT_15M_FAILURES`、成功は数えない)・直近 24 時間の試行 30 回(`LIMIT_24H_ATTEMPTS`)を超えると止める。`rate_limits` の表を直に使う

```ts
import { checkRateLimit } from "@/domains/core/rateLimit/services/server/wrappers/rateLimitHelper";

const result = await checkRateLimit("signupEmail", "192.168.1.1");
```

### 制限を超えたときの応答

- `429 Too Many Requests`、本文 `{ message: "リクエスト回数の上限に達しました。...", resetAt: Date }`、ヘッダー `Retry-After`(秒)
- `rateLimitSubnet` で止めた応答は本文に `silent: true` が付く
- UI ではフォームの下部に赤字の誤りとして出る

### DB テーブル `rate_limits`

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | text (PK) | キー（`{category}:{identifier}`） |
| `count` | integer | 現在のカウント |
| `window_start` | timestamp | ウィンドウ開始時刻 |
| `expires_at` | timestamp | 有効期限 |

## Extension

- 上書き: `src/config/domains/rateLimit.config.ts`(fork が値を変える・カテゴリを足す。読むのは `config.ts` だけ)
- 合成: `config.ts` が上流の既定に上書きと `Extra` を合わせる

## Internals

- カテゴリの型の渡し方: `RateLimitCategory` は `src/wiring/apiRoute.ts` が `lib/routeFactory` に型引数で渡す(lib は features の型を読まない)
