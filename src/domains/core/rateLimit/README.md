# rateLimit - レート制限

## Overview

- IP アドレスなどの識別子ごとのリクエスト制限。スパム登録や過剰アクセスを防ぐ
- 制限はカテゴリ(窓の秒数と上限回数)ごと。上流のカテゴリと既定値は `config.ts`
- 入切の機能を持たない(門番の規則なし、常に開)
- 使う時・直す時の決まりは札 .claude/rules/items/domains/rateLimit.md にある。この README は使い方と仕組み

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

### 鍵・規則・重みで数える(consumeRateLimit / peekRateLimit)

```ts
import { consumeRateLimit, peekRateLimit } from "@/domains/core/rateLimit/services/server";

// カテゴリの規則(固定の窓・maxRequests 回まで)
await consumeRateLimit({ key: { scope: "apiGeneral", identifier: user.userId }, rule: "apiGeneral" });

// 窓を直に書く: 台 × 利用者に 60 分で 30 プレイ、1 分刻みの滑る窓、1 回で 3 プレイ数える
const result = await consumeRateLimit({
  key: { scope: "gachaRaid.play", identifier: `${machineId}:${userId}` },
  rule: { window: "sliding", windowSeconds: 3600, bucketSeconds: 60, limit: 30 },
  weight: 3,
  tx, // 渡せば業務の更新と同じ取引で数える(取引が戻れば数えも戻る)
});
if (!result.allowed) throw new DomainError("上限です", { status: 429 });

// 読むだけ(画面に残りを出す)
const { remaining } = await peekRateLimit({ key: { scope: "gachaRaid.play", identifier: `${machineId}:${userId}` }, rule: { window: "sliding", windowSeconds: 3600, bucketSeconds: 60, limit: 30 } });
```

- scope はカテゴリの名前か `"<地区>.<名前>"`(自分の地区の名前を先頭に。ほかの形は投げる)
- `limit` 回まで通す(足すと `limit` を超える要求は拒んで数えない)。カテゴリで数える `checkRateLimit` も同じ(`maxRequests` 回まで)

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

### 数える関数(`@/domains/core/rateLimit/services/server`)

- `consumeRateLimit({ key: { scope, identifier }, rule, weight? = 1, tx? })` → `RateLimitResult`(`{ allowed, remaining, resetAt, count }`): 数えて足す。足すと `limit` を超えるなら `allowed: false` で足さない
  - `rule` = カテゴリの名前(固定の窓、`windowSeconds`、`limit = maxRequests`)か `{ window: "fixed", windowSeconds, limit }` / `{ window: "sliding", windowSeconds, bucketSeconds, limit }`(`0 < bucketSeconds ≤ windowSeconds`)
  - 固定の窓: 窓の始まりから `windowSeconds` 秒。`resetAt` = 窓の終わり
  - 滑る窓: `bucketSeconds` 刻みの bucket の和で、今から `windowSeconds` 秒の内に始まった bucket を数える。`resetAt` = 一番古い数えた bucket が窓から外れる時
  - `weight` は 1 以上の整数、`count` = 窓の内の重みの和、`remaining = limit − count`
  - `tx` を渡すとその取引で数える(滑る窓は鍵の lock も取引の終わりまで持つ)
- `peekRateLimit(同じ入力)` → `RateLimitResult`: 読むだけ。`allowed` = 今 `weight` を足しても `limit` の内か

### カテゴリで数える関数(`services/server/wrappers/rateLimitHelper.ts`、上の関数の上に乗る)

- `checkRateLimit(category, identifier)`: 制限を確かめてカウントを増やす → `{ allowed: boolean, remaining: number, resetAt: Date, count: number }`
- `getRateLimitStatus(category, identifier)`: 今の状態を返す(カウントは増やさない)
- `cleanupExpiredRateLimits()`: 期限切れの行を消す(呼び手 0。区切り expiry-retire-crons で消える)。期限切れの行は増設点 expiryRules の項目 `plugs/expiryRules/rateLimitsExpired.ts`(個人情報 `pii: true`、cron `expiry-prune`)が消す
- `checkRateLimit` = `consumeRateLimit` にカテゴリの規則を渡す。窓の中で `maxRequests` 回まで通す
- 数えは 1 文の原子的な更新なので、同時に来た要求も上限を超えて通さない

銀行振込の画像の判定専用(`services/server/wrappers/judgmentRateLimit.ts`、識別子は userId):

- `checkJudgmentRateLimit(userId)`・`recordAttempt(userId)`・`recordFailure(userId)`・`getJudgmentRateLimitStatus(userId)`
- 直近 15 分の失敗 3 回(`LIMIT_15M_FAILURES`、成功は数えない)・直近 24 時間の試行 30 回(`LIMIT_24H_ATTEMPTS`)を超えると止める。読むのは `peekRateLimit`、足すのは `consumeRateLimit`(固定の窓、scope `rateLimit.judgeFail15m` / `rateLimit.judgeAttempt24h`)

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
| `id` | text (PK) | 固定の窓 = `{scope}:{identifier}`、滑る窓 = `{scope}:{identifier}:{bucket の始まりの epoch 秒}` |
| `key` | text (null 可) | `{scope}:{identifier}`(滑る窓の和を引く鍵。前からの行は null) |
| `count` | integer | 窓(bucket)の内の重みの和 |
| `window_start` | timestamp | 固定 = 窓の始まり、滑る = bucket の始まり |
| `expires_at` | timestamp | 固定 = 窓の終わり、滑る = bucket の始まり + 窓 |

- 索引 `rate_limits_key_window_idx` (`key`, `window_start`)

## Extension

- 上書き: `src/config/domains/rateLimit.config.ts`(fork が値を変える・カテゴリを足す。読むのは `config.ts` だけ)
- 合成: `config.ts` が上流の既定に上書きと `Extra` を合わせる

## Internals

- API の Factory への差し方: 点 `routeFactoryRateLimit`(`src/lib/routeFactory/extensionPoints.ts`、ちょうど 1 つ)の上流の項目 `plugs/routeFactoryRateLimit/ipRate.ts`(1 行スイッチ、既定 `ipRate.default.ts`。fork は差替点 `rateLimitRouteFactoryRateLimit` で `ipRate.replace.ts` に替える)
- 数え方(`services/server/store.ts`): 固定の窓は 1 文の `INSERT … ON CONFLICT (id) DO UPDATE … WHERE (窓が過ぎた OR count + weight ≤ limit) RETURNING`(行が返らない = 拒否)。滑る窓は 1 つの取引で `pg_advisory_xact_lock(hashtextextended(key, 0))` を取り、窓の内の bucket の和を数えてから今の bucket に足す
- 判定の形と入力の確かめは `services/server/consume.ts` の `createRateLimit`(表を渡す。本物の束は `services/server/rateLimit.ts`)
- カテゴリの型の渡し方: `RateLimitCategory` は項目の型に残り、`src/wiring/apiRoute.ts` が生成された一覧の型から取り出して `lib/routeFactory` に型引数で渡す(lib も wiring も domains の型を読まない)

## Verification

- `pnpm test src/domains/core/rateLimit/services/server/consume.test.mts`(入力の確かめ・規則の解き方、偽物の表)
- `pnpm test --db src/domains/core/rateLimit/services/server/rateLimit.db.test.mts`(実 DB: 固定の窓の同時の数え・weight・窓の数え直し・tx・peek、滑る窓の bucket の和、checkRateLimit / getRateLimitStatus の回数と戻り値)
