# userLoginEvent - ログインイベント / IP 横断検索

ユーザーのログイン / サインアップ成功イベントを **IP 単位で横断検索できる形** に正規化して蓄積するドメイン。

「同一 IP で運用されている複数アカウントの検出」「特定サブネットからの登録の洗い出し」といった、ユーザーをまたぐ IP 集計を高速に行うことが目的。

> 旧来は `users.metadata.loginHistory` (JSONB) に履歴を持っていたが、JSONB スキャンになる横断検索が大規模化で重くなる問題があった。本ドメインはその検索負荷を専用テーブル + `inet` 型インデックスで肩代わりする。両者の関係は後述の [既存フィールドとの関係](#既存フィールドとの関係) を参照。

---

## 基本構成

```
src/features/core/userLoginEvent/
├── constants/
│   └── index.ts                  # event_type / デフォルト retention 日数
├── entities/
│   ├── drizzle.ts                # user_login_events テーブル (ip は inet 型)
│   ├── model.ts                  # UserLoginEvent 型
│   ├── schema.ts                 # 書き込みバリデーション (Zod)
│   └── index.ts
├── services/
│   └── server/
│       ├── drizzleBase.ts        # createCrudService ベース
│       ├── recordLoginEvent.ts   # 記録 (bestEffort)
│       ├── ipAnalytics.ts        # IP 集計クエリ
│       ├── pruning.ts            # 期限切れ削除 (cron)
│       └── index.ts
├── index.ts                       # client-safe バレル (server-only は非 export)
└── README.md
```

`src/app/api/cron/user-login-event-prune/route.ts` … プルーニング cron の API ルート

---

## 記録の流れ

記録は **自動** で行われる。手動呼び出しは不要。

| 契機 | 呼び出し元 | event_type |
|---|---|---|
| ログイン成功 | `user/services/server/wrappers/updateLastAuthenticated.ts` | `login` |
| サインアップ / 再入会成功 | `user/services/server/registration/preRegisterFromAuth.ts` | `signup` |

いずれも `recordLoginEvent()` を呼ぶ。設計上の取り決め:

- **bestEffort**: 書き込み失敗はログイン / 登録フローを阻害しない (失敗時は `console.error` のみ。dead-letter は持たない)。
- **IP 必須**: IP が無い (システム経路等) 場合は黙ってスキップする。本テーブルは IP 集計が主用途のため、IP 無し行を入れる意義が無い。
- **IP / User-Agent のフォールバック**: 引数省略時は ALS context (`getAuditContext()`) から補完する。

---

## 検索 API

`services/server/ipAnalytics.ts`。すべて server-only。

```ts
import {
  countDistinctUsersByIp,
  findUsersBySameIp,
  findUsersBySubnet,
} from "@/features/core/userLoginEvent/services/server";
```

### countDistinctUsersByIp(ip)

同一 IP を利用している distinct user 数を返す。不正運用検知の初手。

```ts
const count = await countDistinctUsersByIp("203.0.113.10");
// => 3
```

### findUsersBySameIp(ip, options?)

指定 IP を利用したことのある user 一覧 (直近順)。

```ts
const rows = await findUsersBySameIp("203.0.113.10", {
  excludeUserId: currentUserId, // 自分自身を除外 (任意)
  limit: 100,                   // 既定 100
});
// => [{ userId, eventCount, lastSeenAt }, ...]
```

### findUsersBySubnet(cidr, options?)

CIDR に含まれる IP を利用した user 一覧。PostgreSQL の `inet <<= cidr` 演算子でサブネット包含判定する。

```ts
const rows = await findUsersBySubnet("203.0.113.0/24", { limit: 200 });
// => [{ userId, eventCount, lastSeenAt }, ...]
```

> `/16` のような極端に広い範囲を大規模テーブルに対して指定する場合は、別途集計テーブル (materialized view 等) の検討余地あり。

---

## DB テーブル

`user_login_events`:

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID (PK) | 主キー |
| `user_id` | UUID | `users.id` への FK (ON DELETE CASCADE) |
| `event_type` | Enum | `signup` / `login` |
| `ip` | **inet** | クライアント IP。`=` の btree 検索に加え `<<=` でサブネット包含検索が index で走る |
| `user_agent` | Text | User-Agent (任意) |
| `occurred_at` | Timestamptz | イベント発生時刻 |
| `retention_days` | Integer | 行単位の保持期間 (日) |
| `created_at` | Timestamptz | 作成時刻 |

インデックス:

| index | 用途 |
|---|---|
| `(user_id, occurred_at)` | ユーザー別履歴タイムライン |
| `(ip, occurred_at)` | **主用途: IP 重複検索** |
| `(event_type, occurred_at)` | 種別別集計 |
| `(created_at)` | retention pruning |

`ip` を text ではなく `inet` 型にしている理由: IPv4/IPv6 統一・文字列ゼロ埋め揺れの排除・index サイズ削減・`<<=` 演算子の利用。

---

## retention と cron

`audit_logs` と同じ「行単位 `retention_days` + 日次 cron プルーニング」パターン。

- デフォルト保持期間: `DEFAULT_LOGIN_EVENT_RETENTION_DAYS = 365` (日)
- 削除タスク: `pruneExpiredUserLoginEvents()` (`pruning.ts`)
- cron: `user-login-event-prune` … 詳細は [cron タスクカタログ](../../../../docs/reference/cron-tasks.md) を参照

IP は個人情報のため、無期限保持にせず retention で自動削除する設計にしている。下流プロジェクトで保持期間を変えたい場合は記録時の `retentionDays` または定数を調整する。

---

## 既存フィールドとの関係

IP に関するデータは現在 **3 箇所に併存** している。本テーブルは「検索性能」の一軸でのみ上位互換であり、旧フィールドの完全な置き換えではない点に注意。

| 格納先 | 主用途 | 保持期間 | 依存コード |
|---|---|---|---|
| `users.metadata.loginHistory` (JSONB) | UI の直近ログイン履歴表示 (直近10件) | 永続 (上書きで10件維持) | UI 表示 |
| `users.signupIp` (text 列) | 登録時 IP の参照 | **永続** | referral 画面 / 管理画面ユーザー詳細 |
| **`user_login_events`** (本テーブル) | **IP 横断検索・集計** | 365日 (cron 削除) | 検索 API (未接続の新規) |

ログイン / サインアップ成功時は、従来の JSON 列書き込みも継続しつつ、本テーブルにも記録する **二重書き込み** の状態。

### なぜ旧フィールドを廃止していないか

- `users.metadata.loginHistory` は UI 表示が依存
- `users.signupIp` は referral 画面・管理画面が直接参照
- 本テーブルは **デプロイ以降のイベントしか持たない** (既存データのバックフィル未実施)
- 本テーブルは 365 日で行が消える一方、`signupIp` は永続 → 監査用途では本テーブルの方が情報を失う

このため現状は「重い横断検索だけ本テーブルに肩代わりさせる」最小スコープに留めている。

### 完全廃止する場合に必要な手順 (別 PR)

1. 既存 `loginHistory` / `signupIp` を本テーブルへ **バックフィル** するマイグレーション
2. `signupIp` を永続監査情報とみなすなら、該当行の retention を無期限化する設計判断
3. referral / 管理画面の参照を本テーブルの検索 API へ **置き換え**
4. その後に列・JSON を削除

---

## 関連ファイル

- ユーザードメイン本体: [`user/README.md`](../user/README.md)
- cron タスクカタログ: [`docs/reference/cron-tasks.md`](../../../../docs/reference/cron-tasks.md)
- 監査ログ (別の IP 記録経路 = `context.ip`): [`docs/how-to/監査ログ採用ガイド.md`](../../../../docs/how-to/監査ログ採用ガイド.md)
