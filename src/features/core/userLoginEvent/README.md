# userLoginEvent - ログインイベント / IP 横断検索

ユーザーのログイン / サインアップ成功イベントと明示ログアウトを **IP 単位で横断検索できる形** に正規化して蓄積するドメイン。

「同一 IP で運用されている複数アカウントの検出」「特定サブネットからの登録の洗い出し」「同一端末で A がログアウトした直後に B がログインした (端末受け渡し) 列の検出」といった、ユーザーをまたぐ IP / セッション列の集計を高速に行うことが目的。

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
│       ├── recordLoginEvent.ts   # 記録 (bestEffort) / recordLogoutEvent
│       ├── ipAnalytics.ts        # IP 集計クエリ
│       ├── sessionHandoff.ts     # 端末受け渡し (logout → 別ユーザー login) 検出
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
| 明示ログアウト | `app/api/auth/logout/route.ts` | `logout` |
| 休止 (pause) | `app/api/auth/pause/route.ts` | `logout` |
| 退会 (withdraw) | `app/api/auth/withdraw/route.ts` | `logout` |

いずれも `recordLoginEvent()` (logout 系は薄いラッパー `recordLogoutEvent(userId)`) を呼ぶ。設計上の取り決め:

- **bestEffort**: 書き込み失敗はログイン / 登録 / ログアウトフローを阻害しない (失敗時は `console.error` のみ。dead-letter は持たない)。
- **IP 必須**: IP が無い (システム経路等) 場合は黙ってスキップする。本テーブルは IP 集計が主用途のため、IP 無し行を入れる意義が無い。
- **IP / User-Agent のフォールバック**: 引数省略時は ALS context (`getAuditContext()`) から補完する。
- **デモユーザーも記録する** (login と同じ)。集計側で `is_demo` を見て除外する (sessionHandoff は `excludeDemo` 既定 true)。

### `logout` の意味と限界

`logout` は **ユーザー操作による明示的なセッション終了** のみ。3 経路 (logout / pause / withdraw) は「この端末でこの時刻にセッションが終わった」という一軸に統一しており、休止・退会という状態変化そのものは `user_status_histories` が持つ (区別したければそちらと JOIN する)。

記録できないもの:

- Cookie の自然失効 (maxAge 切れ) … サーバーに到達しない
- ブラウザ / タブを閉じただけ … 同上
- 管理者によるセッション無効化 … 対象ユーザーの端末上の操作ではないため logout 扱いにしない

したがって「logout 行が無い = セッションが続いている」とは読めない。逆に logout 行がある区間は確実に「その端末で明示終了した」と言える。

`logout` ルートは `access: "public"` のまま。Cookie から `getTokenOnlySession()` で userId を取り、無ければ記録をスキップする (認可ではなく記録用なので DB 同期は不要。routeFactory の監査 actor_id 抽出と同じ根拠)。pause / withdraw はサービス処理が成功した後 (= Cookie を消す直前) にだけ記録する。

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

> **event_type と集計値**: 上記 3 関数は event_type を区別せず全行を数える。`logout` 行が加わったことで `eventCount` は「セッション開始 + 終了」の合算になる (概ね従来の 2 倍弱)。distinct user の判定 (`countDistinctUsersByIp` / 一覧に出るユーザー集合) は不変。開始回数だけが欲しい場合は `event_type IN ('login','signup')` で絞ること。

---

## 端末受け渡し検出 (sessionHandoff)

`services/server/sessionHandoff.ts`。server-only。

「ユーザー A が明示ログアウト (logout / pause / withdraw) した直後、同一 IP (+ 同一 User-Agent) から別ユーザー B がログイン / 新規登録した」列を `user_login_events` の self-join で返す。共有端末で複数アカウントを運用しているケースの最も強い列的証拠になる (単なる「同一 IP に複数アカウント」より、時間順序と UA 一致が加わる分だけ「二人が同じ Wi-Fi にいた」と「端末を手渡した」を分けられる)。

```ts
import {
  findSessionHandoffsByUser,
  findSessionHandoffsByIp,
  type SessionHandoffRow,
} from "@/features/core/userLoginEvent/services/server";

// 特定ユーザーが関与する受け渡し (渡した側 / 受けた側の両方向)
const rows = await findSessionHandoffsByUser(userId, {
  windowMinutes: 5,            // 既定 5。終了→開始の許容間隔
  requireSameUserAgent: true,  // 既定 true。false で IP のみ一致
  excludeDemo: true,           // 既定 true。両側とも非デモに限定
  limit: 50,                   // 既定 50
});
// => [{ fromUserId, toUserId, ip, userAgent, endedAt, startedAt, gapSeconds, startedBy }, ...]
//    fromUserId === userId → このユーザーが渡した側 / toUserId === userId → 受けた側
//    startedBy: "login" | "signup" ("A 退会 → B 新規登録" は signup で出る)

// 管理画面の IP ドリルダウン
const onIp = await findSessionHandoffsByIp("203.0.113.10", { windowMinutes: 10 });
```

設計と限界:

- **終端側は `logout` 行のみ**。Cookie 失効・ブラウザ閉鎖経由の受け渡しは検出できない (上記「`logout` の意味と限界」参照)。
- **同一 Wi-Fi / CGNAT の別人も IP は一致する**。`requireSameUserAgent` (既定 true) で大半は落ちるが、同型端末 + 同一ブラウザ版では衝突し得る。終端側 UA が null の行は候補にしない (null 同士の一致は認めない)。
- **結果は参考証拠**。`deviceFingerprint` の類似照合と同じく単独で断定材料にせず、fingerprint / 回答内容 / 行動特徴など他軸と合わせて評価する。
- **index**: 既存の `(ip, occurred_at)` btree で logout 行ごとに同一 IP かつ時間窓内の開始行を range scan する。追加 index は不要。`ByUser` は from 側 / to 側を `UNION ALL` で結合する (OR で書くと両側の user_id index が使えないため)。
- **時間窓の目安**: 端末の手渡しなら数十秒〜数分。`windowMinutes` を広げるほど同一 Wi-Fi の偶然一致が増える。

### UI レシピ (downstream 実装)

core は画面を同梱しない。ユーザー詳細 (admin) に載せる場合の例:

- `findSessionHandoffsByUser(userId)` を admin API ルート (`createApiRoute` + admin access) で包み、ClientService → hook → 一覧に流す。
- 1 行 = `endedAt` (A の終了) → `gapSeconds` 秒後 → `startedAt` (B の開始)。`fromUserId === userId` なら「渡した相手 = toUserId」、そうでなければ「受けた相手 = fromUserId」として表示する。
- `startedBy === "signup"` は「退会直後の新規登録」の可能性があるので強調表示すると審査しやすい。
- 既存のログイン履歴一覧で `eventType` をバッジ化しているなら `"logout"` → 「ログアウト」を追加し、未知の値は生文字列で表示するフォールバックを入れておく (将来の値追加に備える)。

---

## DB テーブル

`user_login_events`:

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID (PK) | 主キー |
| `user_id` | UUID | `users.id` への FK (ON DELETE CASCADE) |
| `event_type` | Enum (`user_login_event_type`) | `signup` / `login` / `logout`。値の追加は `ALTER TYPE ... ADD VALUE` (db:push) が必要。削除は enum 再作成になるため原則行わない |
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

`sessionHandoff` の self-join は `(ip, occurred_at)` を再利用する。

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
