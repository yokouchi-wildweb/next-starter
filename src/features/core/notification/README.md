# notification ドメイン

管理者・システムからユーザーへお知らせを送信する仕組み。全体/ロール別/個別送信、既読管理、スケジュール配信を提供。ユーザー側UIはフック・APIのみ提供し、ダウンストリーム側で自由に構成する。

---

## ディレクトリ構成

```
src/features/core/notification/
├── entities/
│   ├── drizzle.ts              # notifications テーブル定義
│   ├── notificationRead.ts     # notification_reads テーブル定義（手動、複合PK）
│   ├── schema.ts               # Zod バリデーション
│   └── model.ts                # TypeScript 型定義
├── services/
│   ├── server/
│   │   ├── notificationService.ts   # サービスエントリポイント
│   │   ├── drizzleBase.ts           # 標準CRUD（生成）
│   │   ├── wrappers/
│   │   │   ├── create.ts            # 標準create無効化（405）
│   │   │   └── update.ts            # 公開済み編集ガード
│   │   └── notification/
│   │       ├── sendDirect.ts        # 送信（低レベル）
│   │       ├── sendHelpers.ts       # 送信ヘルパー（sendToUser等）
│   │       ├── sendSafe.ts          # 全send関数のSafe版
│   │       ├── getMyNotifications.ts # ユーザー向け一覧取得
│   │       ├── getUnreadCount.ts    # 未読数取得
│   │       ├── markAsRead.ts        # 個別既読
│   │       ├── markAllAsRead.ts     # 全既読
│   │       └── queryHelpers.ts      # 共通WHERE条件
│   └── client/
│       ├── notificationClient.ts        # 標準CRUDクライアント（生成）
│       └── userNotificationClient.ts    # ユーザー向けAPIクライアント
├── hooks/
│   ├── useMyNotifications.ts            # お知らせ一覧
│   ├── useUnreadNotificationCount.ts    # 未読数（バッジ用）
│   ├── useMarkNotificationAsRead.ts     # 個別既読
│   └── useMarkAllNotificationsAsRead.ts # 全既読
└── components/   # 管理画面コンポーネント（生成）
```

---

## データモデル

### notifications テーブル

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | uuid | PK |
| title | text | タイトル（任意） |
| body | text | 本文（必須） |
| image | text | 画像URL（任意） |
| target_type | enum | all / role / individual |
| target_user_ids | text[] | individual 時の対象ユーザーID |
| target_roles | text[] | role 時の対象ロール |
| sender_type | enum | admin / system |
| created_by_id | uuid | 作成した管理者のユーザーID（任意） |
| metadata | jsonb | プロジェクト固有の追加情報（任意） |
| is_silent | boolean | サイレント通知フラグ（デフォルト: false） |
| published_at | timestamptz | 公開日時（即時 or 予約） |
| notification_template_id | uuid | テンプレートへの参照（任意、将来拡張） |

### notification_reads テーブル

| フィールド | 型 | 説明 |
|-----------|-----|------|
| notification_id | uuid | FK → notifications |
| user_id | uuid | FK → users |
| read_at | timestamptz | 既読日時 |

複合PK: (notification_id, user_id)。レコードなし = 未読。

---

## サーバーサービス API

### sendDirect — お知らせ送信

```typescript
import { notificationService } from "@/features/core/notification/services/server/notificationService";

// 全員向け即時送信
await notificationService.sendDirect({
  body: "メンテナンスのお知らせ",
  targetType: "all",
  senderType: "system",
});

// 特定ユーザーへリンク付き送信
await notificationService.sendDirect({
  title: "注文完了",
  body: "ご注文ありがとうございます。",
  targetType: "individual",
  targetUserIds: [userId],
  senderType: "system",
  metadata: { linkUrl: "/orders/123", linkLabel: "注文詳細" },
});

// ロール指定で予約送信
await notificationService.sendDirect({
  title: "新機能のお知らせ",
  body: "新しい機能が追加されました。",
  targetType: "role",
  targetRoles: ["contributor"],
  senderType: "admin",
  createdById: adminUserId,
  publishedAt: new Date("2026-04-01T09:00:00+09:00"),
});
```

#### SendDirectInput

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| title | string | - | タイトル |
| body | string | Yes | 本文 |
| image | string | - | 画像URL |
| targetType | "all" \| "role" \| "individual" | Yes | 送信対象 |
| targetUserIds | string[] | individual時 | 対象ユーザーID |
| targetRoles | string[] | role時 | 対象ロール |
| senderType | "admin" \| "system" | Yes | 送信者種別 |
| createdById | string | - | 管理者のユーザーID |
| metadata | Record\<string, unknown\> | - | プロジェクト固有の追加情報 |
| silent | boolean | - | サイレント通知（省略時は false） |
| publishedAt | Date | - | 公開日時（省略時は即時） |

### ヘルパー関数 — 簡易送信

`sendDirect` のラッパー。`senderType: "system"` 固定で、ターゲット指定を簡略化する。

```typescript
// 特定ユーザー1名に送信
await notificationService.sendToUser(userId, {
  title: "購入完了",
  body: "1,000コインを購入しました",
  metadata: { actionType: "purchase", amount: 1000 },
});

// 複数ユーザーに送信
await notificationService.sendToUsers([userId1, userId2], { body: "..." });

// ロール指定（string | string[]）
await notificationService.sendToRole("contributor", { body: "..." });
await notificationService.sendToRole(["admin", "editor"], { body: "..." });

// 全員に送信
await notificationService.sendToAll({ body: "メンテナンスのお知らせ" });
```

#### NotificationContent（ヘルパー共通入力型）

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| title | string | - | タイトル |
| body | string | Yes | 本文 |
| image | string | - | 画像URL |
| metadata | Record\<string, unknown\> | - | プロジェクト固有の追加情報 |
| silent | boolean | - | サイレント通知（省略時は false） |
| publishedAt | Date | - | 公開日時（省略時は即時） |

### Safe版 — エラーを握りつぶす送信

全 send 関数に対応する Safe 版を提供。失敗時は `console.error` でログ出力し `null` を返す。本体処理（購入、ランクアップ等）を通知送信の失敗で巻き込まないために使用する。

```typescript
// 通常版: 失敗時に例外が発生 → 本体処理に影響する可能性
await notificationService.sendToUser(userId, { body: "..." });

// Safe版: 失敗時に null を返す → 本体処理に影響しない
await notificationService.sendToUserSafe(userId, { body: "..." });
```

対応関数: `sendDirectSafe`, `sendToUserSafe`, `sendToUsersSafe`, `sendToRoleSafe`, `sendToAllSafe`

### サイレント通知

`silent: true` で送信された通知は、未読バッジ・未読フィルタから除外される。通知一覧には表示されるが、ユーザーに能動的な確認を求めない。

ユースケース: 購入完了画面で既に情報を表示済みだが、履歴として通知一覧に残したい場合。

```typescript
await notificationService.sendToUserSafe(userId, {
  title: "購入完了",
  body: "1,000コインを購入しました",
  metadata: { actionType: "purchase", amount: 1000 },
  silent: true,
});
```

### getMyNotifications — ユーザー向け一覧取得

```typescript
const notifications = await notificationService.getMyNotifications(
  userId,
  userRole,
  { limit: 20, offset: 0, unreadOnly: true }
);
```

### getUnreadCount — 未読数取得

```typescript
const count = await notificationService.getUnreadCount(userId, userRole);
```

### markAsRead / markAllAsRead — 既読マーク

```typescript
await notificationService.markAsRead(notificationId, userId);
await notificationService.markAllAsRead(userId, userRole);
```

---

## APIエンドポイント

### 管理者向け
| メソッド | パス | 説明 |
|---------|------|------|
| POST | /api/notification/send | お知らせ送信（admin権限必須） |

標準CRUD（/api/[domain]/notification）も利用可能。ただし POST（create）は 405 を返す。

### ユーザー向け
| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/notification/my | 自分のお知らせ一覧 |
| GET | /api/notification/my/unread-count | 未読数 |
| POST | /api/notification/[id]/read | 個別既読マーク |
| POST | /api/notification/read-all | 全既読マーク |

GET /api/notification/my クエリパラメータ: limit, offset, unreadOnly(true/false)

---

## クライアントフック

### useMyNotifications — お知らせ一覧

```typescript
const { notifications, isLoading, mutate } = useMyNotifications({
  limit: 20,
  unreadOnly: false,
});
```

### useUnreadNotificationCount — 未読数（バッジ表示用）

```typescript
const { count, isLoading } = useUnreadNotificationCount();
// count: number | undefined（ロード中は undefined）
```

### useMarkNotificationAsRead — 個別既読

```typescript
const { markAsRead, isLoading } = useMarkNotificationAsRead();
await markAsRead(notificationId);
// 実行後、一覧と未読数のSWRキャッシュが自動更新される
```

### useMarkAllNotificationsAsRead — 全既読

```typescript
const { markAllAsRead, isLoading } = useMarkAllNotificationsAsRead();
await markAllAsRead();
```

---

## metadata の活用

`metadata`（jsonb）はプロジェクト固有の追加情報を格納する汎用フィールド。マイグレーション不要で自由に拡張可能。

```typescript
// ダウンストリーム側で型を定義
type NotificationMeta = {
  linkUrl?: string;
  linkLabel?: string;
  actionType?: string;
};

// 送信時
await notificationService.sendDirect({
  body: "ランクアップしました！",
  targetType: "individual",
  targetUserIds: [userId],
  senderType: "system",
  metadata: { linkUrl: "/mypage", linkLabel: "マイページへ" },
});

// 表示時（フック経由）
const { notifications } = useMyNotifications();
const meta = notifications?.[0]?.metadata as NotificationMeta | null;
if (meta?.linkUrl) {
  // リンクボタンを表示
}
```

---

## スケジュール配信（予約投稿）

`publishedAt` に未来日時を指定するだけで予約送信になる。cron/バッチ不要。

- ユーザー側クエリは `published_at <= now()` で自動フィルタリング
- 管理画面では published_at と現在時刻の比較で「公開済み / 予約中」を表示
- 予約中のお知らせのみ編集・削除可能（公開済みは編集不可、削除は可能）

---

## CRUD制御

| 操作 | 挙動 |
|------|------|
| create | 405 で拒否（/api/notification/send を使用） |
| update | 公開済み（published_at <= now()）は 400 で拒否 |
| delete | 常に許可（誤送信の取り下げ対応） |

---

## ダウンストリームでの実装例

### パターン1: ログイン時モーダル

```typescript
// ログイン後のページで未読チェック
const { count } = useUnreadNotificationCount();
const { notifications } = useMyNotifications({ unreadOnly: true, limit: 5 });
const { markAllAsRead } = useMarkAllNotificationsAsRead();

if (count && count > 0) {
  // モーダル表示 → 確認ボタンで markAllAsRead()
}
```

### パターン2: ヘッダーバッジ + 一覧ページ

```typescript
// ヘッダーコンポーネント
const { count } = useUnreadNotificationCount();
// count > 0 ならアイコンにバッジ表示

// 一覧ページ
const { notifications } = useMyNotifications({ limit: 20 });
const { markAsRead } = useMarkNotificationAsRead();
// 各通知をクリック時に markAsRead(id)
```

### パターン3: システム通知の発火

```typescript
// サーバーサービスから呼び出し（例: ランクアップ時）
await notificationService.sendToUserSafe(userId, {
  title: "ランクアップ",
  body: `${previousRank} → ${newRank} にランクアップしました！`,
  metadata: { actionType: "rank_up", rankName: newRank },
});
```

### パターン4: サイレント通知（購入完了の履歴記録）

```typescript
// 購入完了画面で既に表示済み → サイレントで履歴だけ残す
await notificationService.sendToUserSafe(userId, {
  title: "購入完了",
  body: `${amount}コインを購入しました`,
  metadata: { actionType: "purchase", amount },
  silent: true,
});
```

---

## 未読通知モーダル（UnreadNotificationModal）

ホワイトリストに登録されたパスへの遷移時に、未読通知を1件ずつモーダルで表示するコンポーネント。

### 設定

`app-features.config.ts` で制御:

```typescript
notification: {
  showUnreadModal: true,
  unreadModalPaths: ["/", "/wallet/*"],
}
```

### パスマッチング

- 末尾に `*` なし → **完全一致**（例: `"/"` はトップページのみ）
- 末尾に `*` あり → **前方一致**（例: `"/wallet/*"` は `/wallet`, `/wallet/coin/purchase/complete` 等にマッチ）

---

## 将来の拡張（未実装）

- **テンプレート機能**: notificationTemplate ドメインを活用した変数置換送信（sendFromTemplate）
- **テンプレート変数エディタ**: 管理画面でのカスタムUI
- **管理画面送信UI**: テンプレート選択 → 送信先選択 → プレビュー → 送信のフロー
