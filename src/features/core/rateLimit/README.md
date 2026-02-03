# rateLimit - レート制限

IPアドレスベースのリクエスト制限機能。スパム登録や過剰アクセスを防止する。

---

## 基本構成

```
src/features/core/rateLimit/
├── constants/
│   └── index.ts              # 型定義、キー生成関数
├── entities/                  # Drizzleスキーマ（自動生成）
├── services/
│   └── server/
│       └── wrappers/
│           └── rateLimitHelper.ts  # 汎用ヘルパー
└── README.md

src/config/app/
└── rate-limit.config.ts       # ルール設定（ユーザー編集用）
```

---

## 使い方

### 1. ルール追加

`src/config/app/rate-limit.config.ts` にカテゴリを追加:

```ts
export const RATE_LIMIT_CONFIG = {
  // 既存のルール...

  // 新規追加例: API一般
  apiGeneral: {
    windowSeconds: 60,    // 1分間
    maxRequests: 100,     // 100回まで
  },
} as const;
```

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
