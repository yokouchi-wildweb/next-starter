# userLoginEvent - ログインイベント / IP 横断検索

## Overview

- ユーザーのログイン / サインアップ成功イベントと明示ログアウトを **IP 単位で横断検索できる形** に正規化して蓄積するドメイン
- 目的: 「同一 IP で運用されている複数アカウントの検出」「特定サブネットからの登録の洗い出し」「同一端末で A がログアウトした直後に B がログインした (端末受け渡し) 列の検出」といった、ユーザーをまたぐ IP / セッション列の集計を速く行う
- 横断検索の負荷を、`users.metadata.loginHistory` (JSONB) のスキャンではなく専用テーブル + `inet` 型インデックスで受ける(旧フィールドとの関係は Internals「既存フィールドとの関係」)
- 入切の機能を持たない(門番の規則なし、常に開)。記録は自動で、呼び手が足す物は無い

## Usage

### 同じ IP・サブネットのユーザーを調べる

```ts
import {
  countDistinctUsersByIp,
  findUsersBySameIp,
  findUsersBySubnet,
} from "@/domains/userLoginEvent/services/server";

const count = await countDistinctUsersByIp("203.0.113.10"); // 不正運用検知の初手 => 3
const rows = await findUsersBySameIp("203.0.113.10", { excludeUserId: currentUserId, limit: 100 });
const onSubnet = await findUsersBySubnet("203.0.113.0/24", { limit: 200 });
```

- 3 関数は event_type を区別せず全行を数える(開始回数の数え方は `.claude/rules/items/domains/userLoginEvent.md` の login_event_starts)
- `/16` のような極端に広い範囲を大規模テーブルに対して引くときは、別の集計テーブル (materialized view 等) が要りうる

### 端末受け渡しを調べる

```ts
import {
  findSessionHandoffsByUser,
  findSessionHandoffsByIp,
  type SessionHandoffRow,
} from "@/domains/userLoginEvent/services/server";

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

- 時間窓の目安: 端末の手渡しなら数十秒〜数分。`windowMinutes` を広げるほど同一 Wi-Fi の偶然一致が増える

### UI レシピ (downstream 実装)

core は画面を同梱しない。ユーザー詳細 (admin) に載せる場合の例:

- `findSessionHandoffsByUser(userId)` を admin API ルート (`createApiRoute` + admin access) で包み、ClientService → hook → 一覧に流す。
- 1 行 = `endedAt` (A の終了) → `gapSeconds` 秒後 → `startedAt` (B の開始)。`fromUserId === userId` なら「渡した相手 = toUserId」、そうでなければ「受けた相手 = fromUserId」として表示する。
- `startedBy === "signup"` は「退会直後の新規登録」の可能性があるので強調表示すると審査しやすい。
- 既存のログイン履歴一覧で `eventType` をバッジ化しているなら `"logout"` → 「ログアウト」を追加し、未知の値は生文字列で表示するフォールバックを入れておく (将来の値追加に備える)。

## API

### 検索(`services/server/ipAnalytics.ts`、server-only)

- `countDistinctUsersByIp(ip)` → 同一 IP を利用している distinct user 数
- `findUsersBySameIp(ip, { excludeUserId?, limit? = 100 })` → 指定 IP を利用したことのある user 一覧 (直近順) `[{ userId, eventCount, lastSeenAt }]`
- `findUsersBySubnet(cidr, { limit? })` → CIDR に含まれる IP を利用した user 一覧 (`inet <<= cidr` で包含判定) `[{ userId, eventCount, lastSeenAt }]`
- `eventCount` は「セッション開始 + 終了」の合算(logout 行も数える)。distinct user の判定は event_type に依らない

### 端末受け渡し(`services/server/sessionHandoff.ts`、server-only)

- `findSessionHandoffsByUser(userId, options?)` / `findSessionHandoffsByIp(ip, options?)` → `SessionHandoffRow[]`
- options: `windowMinutes`(既定 5、終了→開始の許容間隔)/ `requireSameUserAgent`(既定 true)/ `excludeDemo`(既定 true)/ `limit`(既定 50)
- 行: `{ fromUserId, toUserId, ip, userAgent, endedAt, startedAt, gapSeconds, startedBy: "login" | "signup" }`

### 記録(`services/server/recordLoginEvent.ts`)

- `recordLoginEvent(input)` / `recordLogoutEvent(userId)`(logout 系の薄いラッパー)。IP / User-Agent を省くと ALS context (`getAuditContext()`) から補う
- 削除: `pruneExpiredUserLoginEvents()`(`pruning.ts`)

### DB テーブル `user_login_events`

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

## Extension

- 保持期間: 既定 `DEFAULT_LOGIN_EVENT_RETENTION_DAYS = 365`(日)。下流が変えるときは記録時の `retentionDays` か定数を変える

## Internals

### 記録の流れ

| 契機 | 呼び出し元 | event_type |
|---|---|---|
| ログイン成功 | `user/services/server/wrappers/updateLastAuthenticated.ts` | `login` |
| サインアップ / 再入会成功 | `user/services/server/registration/preRegisterFromAuth.ts` | `signup` |
| 外部の認証の身元からの新規作成・再登録(LINE など) | `user/services/server/registration/createFromProvider.ts` | `signup` |
| 明示ログアウト | `app/api/auth/logout/route.ts` | `logout` |
| 休止 (pause) | `app/api/account-lifecycle/pause/route.ts` | `logout` |
| 退会 (withdraw) | `app/api/account-lifecycle/withdraw/route.ts` | `logout` |

- 失敗しても書き込み元(ログイン / 登録 / ログアウト)を止めない(`console.error` だけ、dead-letter は持たない)
- IP が無い (システム経路等) 行は書かない(本テーブルは IP 集計が主用途)
- デモユーザーも記録する (login と同じ)。集計側で `is_demo` を見て除く (sessionHandoff は `excludeDemo` 既定 true)

### `logout` の意味と限界

`logout` は **ユーザー操作による明示的なセッション終了** のみ。3 経路 (logout / pause / withdraw) は「この端末でこの時刻にセッションが終わった」という一軸に統一しており、休止・退会という状態変化そのものは `user_status_histories` が持つ (区別したければそちらと JOIN する)。

記録できないもの:

- Cookie の自然失効 (maxAge 切れ) … サーバーに到達しない
- ブラウザ / タブを閉じただけ … 同上
- 管理者によるセッション無効化 … 対象ユーザーの端末上の操作ではないため logout 扱いにしない

したがって「logout 行が無い = セッションが続いている」とは読めない。逆に logout 行がある区間は確実に「その端末で明示終了した」と言える。

`logout` ルートは `access: "public"`(`allowStatuses` は全ステータス)。userId は Factory が解いた `ctx.user` から取り、無ければ記録しない。pause / withdraw はサービス処理が成功した後 (= Cookie を消す直前) にだけ記録する。

### 端末受け渡しの検出の仕組み

- `user_login_events` の self-join で「ユーザー A が明示ログアウト (logout / pause / withdraw) した直後、同一 IP (+ 同一 User-Agent) から別ユーザー B がログイン / 新規登録した」列を返す。時間順序と UA 一致が加わる分だけ「二人が同じ Wi-Fi にいた」と「端末を手渡した」を分けられる
- **終端側は `logout` 行のみ**。Cookie 失効・ブラウザ閉鎖経由の受け渡しは検出できない (上記「`logout` の意味と限界」参照)。
- **同一 Wi-Fi / CGNAT の別人も IP は一致する**。`requireSameUserAgent` (既定 true) で大半は落ちるが、同型端末 + 同一ブラウザ版では衝突し得る。終端側 UA が null の行は候補にしない (null 同士の一致は認めない)。
- **index**: 既存の `(ip, occurred_at)` btree で logout 行ごとに同一 IP かつ時間窓内の開始行を range scan する。追加 index は不要。`ByUser` は from 側 / to 側を `UNION ALL` で結合する (OR で書くと両側の user_id index が使えないため)。

### index と型

- `(ip, occurred_at)` が主用途(IP 重複検索)。`sessionHandoff` の self-join もこれを使う
- `ip` は text ではなく `inet`: IPv4/IPv6 統一・文字列ゼロ埋め揺れの排除・index サイズ削減・`<<=` 演算子の利用

### retention と cron

- `audit_logs` と同じ「行単位 `retention_days` + 日次 cron プルーニング」。IP は個人情報なので無期限に持たない
- cron: `user-login-event-prune`(`src/app/api/cron/user-login-event-prune/`、1 日 1 回)。配線の仕組みは `src/lib/cron/README.md`

### 既存フィールドとの関係

IP に関するデータは現在 **3 箇所に併存** している。本テーブルは「検索性能」の一軸でのみ上位互換であり、旧フィールドの完全な置き換えではない点に注意。

| 格納先 | 主用途 | 保持期間 | 依存コード |
|---|---|---|---|
| `users.metadata.loginHistory` (JSONB) | UI の直近ログイン履歴表示 (直近10件) | 永続 (上書きで10件維持) | UI 表示 |
| `users.signupIp` (text 列) | 登録時 IP の参照 | **永続** | referral 画面 / 管理画面ユーザー詳細 |
| **`user_login_events`** (本テーブル) | **IP 横断検索・集計** | 365日 (cron 削除) | 検索関数(core の画面・API からは未接続。`deviceFingerprint` の類似照合と組で使う想定) |

ログイン / サインアップ成功時は、従来の JSON 列書き込みも継続しつつ、本テーブルにも記録する **二重書き込み** の状態。

- `users.metadata.loginHistory` は UI 表示が、`users.signupIp` は referral 画面・管理画面が参照する
- 本テーブルはデプロイ以降のイベントしか持たない(既存データのバックフィルは無い)
- 本テーブルは 365 日で行が消え、`signupIp` は永続

## Related

- ユーザードメイン本体: [`user/README.md`](../user/README.md)
- cron 基盤: [`src/lib/cron/README.md`](../../../lib/cron/README.md)
- 監査ログ (別の IP 記録経路 = `context.ip`): [`auditLog/README.md`](../auditLog/README.md)
