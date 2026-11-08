# rateLimit - レート制限

IPアドレスベースのリクエスト制限機能。スパム登録や過剰アクセスを防止する。

---

## 基本構成

```
src/features/core/rateLimit/
├── config.ts                  # カテゴリと制限の既定・型 RateLimitRule / RateLimitCategory・合成(上書きと Extra)
├── constants/
│   └── index.ts              # 型定義、キー生成関数
├── entities/                  # Drizzleスキーマ（自動生成）
├── services/
│   └── server/
│       └── wrappers/
│           └── rateLimitHelper.ts  # 汎用ヘルパー
└── README.md

src/config/features/
└── rateLimit.config.ts        # 上書き(fork が値を変える・カテゴリを足す。config.ts だけが読む)
```

---

## 使い方

### 1. ルール追加・値の変更

上流のカテゴリは `config.ts` の既定(上流が足す)。fork は上書き `src/config/features/rateLimit.config.ts` で値を変え、自分のカテゴリを足す(足す名前は `Extra` 型で宣言する。値はリテラル):

```ts
// src/config/features/rateLimit.config.ts
import type { RateLimitOverride, RateLimitRule } from "@/features/rateLimit/config";

export type Extra = { winReportVerify: RateLimitRule };

export default {
  login: { maxRequests: 10 }, // 上流のカテゴリの値を変える
  winReportVerify: { windowSeconds: 300, maxRequests: 5 }, // 自分のカテゴリ(5 分に 5 回)
} satisfies RateLimitOverride<Extra>;
```

`RateLimitCategory`(上流 + `Extra` の名前)は `src/wiring/apiRoute.ts` が `lib/routeFactory` に型引数で渡す(lib は features の型を読まない、設定の議会 L1.25)。route の `rateLimit: "<名前>"` に知らない名前を書くと型で落ちる。

### 2. APIルートに適用

`createApiRoute` の `rateLimit` オプションで指定:

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

これだけで、同一IPからのリクエストが制限される。

---

## 設定オプション

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `windowSeconds` | number | 制限ウィンドウの秒数 |
| `maxRequests` | number | ウィンドウ内の最大リクエスト数 |

---

## 現在のルール

| カテゴリ | ウィンドウ | 上限 | 用途 |
|----------|-----------|------|------|
| `signupEmail` | 1時間 | 7回 | メール送信系（send-email-link等） |
| `signupRegister` | 1時間 | 3回 | 本登録（register） |
| `login` | 15分 | 5回 | ログイン試行 |
| `passwordReset` | 1時間 | 3回 | パスワードリセット |
| `apiGeneral` | 1分 | 60回 | 汎用API |

---

## ヘルパー関数

`src/features/core/rateLimit/services/server/wrappers/rateLimitHelper.ts`

### checkRateLimit(category, identifier)

レート制限をチェックし、カウントを増加させる。

```ts
import { checkRateLimit } from "@/features/core/rateLimit/services/server/wrappers/rateLimitHelper";

const result = await checkRateLimit("signup", "192.168.1.1");
// result: { allowed: boolean, remaining: number, resetAt: Date, count: number }
```

### getRateLimitStatus(category, identifier)

現在の状態を取得（カウントは増やさない）。

### cleanupExpiredRateLimits()

期限切れレコードを削除。Cron Jobなどで定期実行用。

---

## DBテーブル

`rate_limits` テーブル:

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | text (PK) | キー（`{category}:{identifier}`） |
| `count` | integer | 現在のカウント |
| `window_start` | timestamp | ウィンドウ開始時刻 |
| `expires_at` | timestamp | 有効期限 |

---

## 制限超過時の挙動

- APIは `429 Too Many Requests` を返す
- レスポンス: `{ message: "リクエスト回数の上限に達しました。...", resetAt: Date }`
- UIではフォーム下部に赤字でエラーメッセージが表示される

---

## 拡張例

### ユーザーIDベースの制限

IPではなくユーザーIDで制限したい場合:

```ts
// session.userIdを識別子として使用
const result = await checkRateLimit("apiGeneral", session.userId);
```

### 複合キーでの制限

```ts
// IPとエンドポイントの組み合わせ
const result = await checkRateLimit("apiGeneral", `${ip}:/api/specific`);
```
