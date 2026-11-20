# chatRoom

## Overview

- Firestore ベースのリアルタイムチャット機能を提供するコアドメイン。fork はこの上に、プロジェクト固有の UI や拡張機能を作る
- リアルタイム性が要るので、通常のドメインと違い REST API を経由せず Firestore SDK を直接操作する。管理画面向けには自動生成の CRUD（API 経由）も並行して存在する
- 使う時・直す時の決まりは札 .claude/rules/items/features/chatRoom.md にある

```
┌─ 統合 Hook ──────────────────────────────────────────────────┐
│  useChatScreen         チャット画面の全機能を一括提供          │
│  useUnreadCount        未読ルーム数（バッジ表示用）            │
├─ 個別 Hook ──────────────────────────────────────────────────┤
│  useChatRooms          ルーム一覧のリアルタイム購読            │
│  useChatRoomSubscription  単一ルームのリアルタイム購読         │
│  useChatMessages       メッセージ取得 + 新着購読              │
│  useChatMessageSender  メッセージ送信（楽観的UI付き）          │
│  useMergedMessages     実メッセージ + pending の統合           │
│  useReadAt             既読更新（入室・滞在・退出）            │
│  useResolvedParticipants  参加者プロフィール解決               │
└──────────────┬───────────────────────────────────────────────┘
               │ 直接呼び出し（HTTP を経由しない）
┌─ Service 層 ─┴──────────────────────────────────────────────┐
│  firestoreClient.ts    ルーム操作（作成・購読・参加者管理）    │
│  messageClient.ts      メッセージ操作（送信・編集・削除・取得）│
│  bulkMessageClient.ts  複数ユーザーへの一斉メッセージ送信      │
└──────────────┬──────────────────────────────────────────────┘
               │ Firestore SDK
┌─ Firestore ──┴──────────────────────────────────────────────┐
│  chat_rooms/{roomId}                                         │
│  chat_rooms/{roomId}/messages/{messageId}                     │
└──────────────────────────────────────────────────────────────┘
```

## Usage

### Firestore 複合インデックス

チャット機能の動作には以下の複合インデックスが必要。未作成の場合 `subscribeRooms` でエラーになる。

**ルーム一覧用（必須）**

| コレクション ID | フィールド | 順序 |
|---|---|---|
| `chat_rooms` | `participants` | Arrays |
| | `lastMessageSnapshot.createdAt` | Descending |

**ルームタイプフィルタ用**（`useChatRooms` で `type` オプションを使う場合のみ）

| コレクション ID | フィールド | 順序 |
|---|---|---|
| `chat_rooms` | `type` | Ascending |
| | `participants` | Arrays |
| | `lastMessageSnapshot.createdAt` | Descending |

> Firebase コンソール → Firestore Database → インデックス → 複合インデックスを作成。
> インデックス未作成でクエリ実行すると、ブラウザコンソールに作成用の直リンクが表示される。

**管理画面の一覧用（必須。管理画面のチャットルーム一覧 `/admin/chat-rooms` を使う場合）**

| コレクション ID | フィールド | 順序 |
|---|---|---|
| `chat_rooms` | `deletedAt` | Ascending |
| | `updatedAt` | Descending |

- 一覧はサーバー側の `search`（`deletedAt == null` + 既定の並び `updatedAt` 降順）で読む。未作成だと一覧の画面がエラーページになる
- エラーと作成用のリンクはサーバーのログに出る（Admin SDK の `FAILED_PRECONDITION`）。ブラウザコンソールには出ない

**管理画面の名前検索用（未確認）**

一覧の検索ボックス（`searchFields: ["name"]`）で名前を入れると、上の index では足りず `FAILED_PRECONDITION` になる（開発環境で確認）。エラーが求める定義は次のとおり。

| コレクション ID | フィールド | 順序 |
|---|---|---|
| `chat_rooms` | `deletedAt` | Ascending |
| | `updatedAt` | Descending |
| | `name` | Descending |

- 上流はこの index を作っておらず、作成後に名前検索が通るかは確かめていない。使う fork は作ってから検索を 1 回試す
- 作らない場合、検索ボックスで名前を入れた一覧はエラーページになる（検索なしの一覧は動く）
- Firestore の名前検索は前方一致・大文字小文字を区別する

**index の入れ方**（どれか 1 つ）

- コンソールで上の表どおりに作る、またはエラーの直リンクを開く（リンクはプロジェクトごと）
- firebase CLI: fork の手元の `firestore.indexes.json` に足し、fork の `firebase.json` に `"firestore": { "indexes": "firestore.indexes.json" }` を足して `firebase deploy --only firestore:indexes --project <project-id>`。どちらのファイルも fork ごとのもの（上流は `firestore.indexes.json` を同梱せず、`.gitignore` 対象）。既に持つ fork は自分のファイルに足す

```json
{
  "indexes": [
    {
      "collectionGroup": "chat_rooms",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "deletedAt", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### チャット画面（最小構成）

- `useChatScreen` を使えば、メッセージ取得・送信・楽観的 UI・既読更新を一行で接続できる

```tsx
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { useChatScreen } from "@/features/chatRoom/hooks/firestore/useChatScreen";

function ChatScreen({ roomId, uid }: { roomId: string; uid: string }) {
  const {
    displayMessages, isLoading, isLoadingMore, hasMore, loadMore,
    sendText, sendFile, retry, dismiss, cancelUpload,
  } = useChatScreen(roomId, uid);

  return (
    <div>
      {/* 過去のメッセージ: InfiniteScrollList(@/components/Widgets/InfiniteScrollList)のボタンで読む形 + 上に足す向き */}
      <InfiniteScrollList
        items={displayMessages}
        isInitialLoading={isLoading}
        isFetchingMore={isLoadingMore}
        hasMore={hasMore}
        loadMode="button"
        onLoadMore={() => void loadMore()}
        loadMoreLabel="過去のメッセージを読み込む"
        direction="prepend"
        hideCompletedNotice
        emptyNode={null}
      >
        {(items) =>
          items.map((dm) => (
            <MessageBubble
              key={dm.message.id}
              message={dm.message}
              isPending={dm.isPending}
              sendingStatus={dm.sendingStatus}
              uploadProgress={dm.uploadProgress}
              onRetry={() => retry(dm.message.id)}
              onDismiss={() => dismiss(dm.message.id)}
              onCancelUpload={() => cancelUpload(dm.message.id)}
            />
          ))
        }
      </InfiniteScrollList>

      <MessageInput onSendText={sendText} onSendFile={sendFile} />
    </div>
  );
}
```

- `useChatScreen` の内部構成: `useChatMessages` + `useChatMessageSender` + `useMergedMessages` + `useReadAt`。カスタムな接続が必要な場合は個別フックを直接使う(下の「useChatScreen を使わないカスタム構成」)

### ルーム一覧 + 未読バッジ

```tsx
import { useChatRooms } from "@/features/chatRoom/hooks/firestore/useChatRooms";
import { useResolvedParticipants } from "@/features/chatRoom/hooks/firestore/useResolvedParticipants";
import { isRoomUnread } from "@/features/chatRoom/utils/unread";

function ChatRoomList({ uid }: { uid: string }) {
  const { rooms, isLoading } = useChatRooms(uid);

  // resolver はダウンストリームの User モデルに合わせて実装する
  const { profileMap } = useResolvedParticipants(rooms, uid, async (uids) => {
    const users = await fetchUsersByIds(uids);
    return new Map(users.map((u) => [u.id, { name: u.name, avatarUrl: u.avatarUrl }]));
  });

  return (
    <ul>
      {rooms.map((room) => {
        const otherUid = room.participants?.find((p) => p !== uid);
        const profile = otherUid ? profileMap.get(otherUid) : null;

        return (
          <li key={room.id}>
            {room.type === "direct" ? profile?.name : room.name}
            {isRoomUnread(room, uid) && <span>●</span>}
            <p>{room.lastMessageSnapshot?.type === "text" ? room.lastMessageSnapshot.content : "添付"}</p>
          </li>
        );
      })}
    </ul>
  );
}
```

### 未読数バッジ（ヘッダー・ボトムナビ用）

```tsx
import { useUnreadCount } from "@/features/chatRoom/hooks/firestore/useUnreadCount";

const unreadCount = useUnreadCount(uid);
// <Badge count={unreadCount} />
```

### 一斉メッセージ送信

- 複数ユーザーに同一のダイレクトメッセージを一斉送信する

```tsx
import { useBulkMessageSender } from "@/features/chatRoom/hooks/firestore/useBulkMessageSender";

function BulkMessageForm({ uid }: { uid: string }) {
  const { send, status, progress, result, reset } = useBulkMessageSender(uid);

  const handleSend = async () => {
    await send({
      targetUserIds: selectedUserIds,
      content: messageText,
    });
  };

  if (status === "sending" && progress) {
    return <p>{progress.completed} / {progress.total} 件送信中...</p>;
  }

  if (status === "done" && result) {
    return (
      <div>
        <p>完了: 成功 {result.successCount} 件 / 失敗 {result.failedCount} 件</p>
        <button onClick={reset}>戻る</button>
      </div>
    );
  }

  return <button onClick={handleSend}>一斉送信</button>;
}
```

### カスタムルームタイプ

- `type` フィールドを拡張してプロジェクト固有のチャット種別を追加できる。タイプフィルタを使う場合は、対応する複合インデックスが要る（「Firestore 複合インデックス」）

```tsx
// ルームタイプ別のフィルタリング
const { rooms } = useChatRooms(uid, { type: "scout" as any });

// 未読数もタイプ別に取得可能
const scoutUnread = useUnreadCount(uid, { type: "scout" as any });
```

### ルームへの独自フィールド追加

Firestore はスキーマレスのため、コアファイルの変更なしに独自フィールドを追加できる。

- ルール例（`firestore.rules.example`）はこの独自フィールドを通さない
- 書き込みは chatRoom のクライアントだけが使える。既定の `fstore` で書くと、メール+パスワード・OAuth のユーザーは `request.auth.uid` が `users.id` にならない（Internals「chatRoom 専用の Firebase アプリ」）。独自フィールドを書くクライアント関数は今は無い

```ts
// 読み取り（型拡張）
type ExtendedChatRoom = ChatRoom & { iconUrl?: string; description?: string };
```

### メッセージメタデータの拡張

- `MessageMetadata` は `BaseMessageMetadata & Record<string, unknown>` として定義されており、コアファイルを変更せずに任意のフィールドを追加できる

**書き込み（コア変更不要）**

```ts
await sendTextMessage({
  roomId,
  content: "この求人に興味はありませんか？",
  senderId: uid,
  metadata: {
    linkedResources: [
      { type: "job", id: "job_123", url: "/jobs/job_123", title: "フロントエンドエンジニア" },
    ],
  },
});
```

**読み取り（Zod で型安全に）**

```ts
import { z } from "zod";
import { getTypedMetadata } from "@/features/chatRoom/utils/metadata";

const LinkedResourceSchema = z.object({
  linkedResources: z.array(z.object({
    type: z.string(),
    id: z.string(),
    url: z.string(),
    title: z.string().optional(),
  })),
});

function ScoutMessageCard({ message }: { message: ChatMessage }) {
  const meta = getTypedMetadata(message, LinkedResourceSchema);
  if (!meta) return null;

  return (
    <div>
      {meta.linkedResources.map((r) => (
        <a key={r.id} href={r.url}>{r.title ?? r.id}</a>
      ))}
    </div>
  );
}
```

> `getTypedMetadata` は `safeParse` を使うため、スキーマに合致しない場合は `null` を返す（クラッシュしない）。

### メッセージの表示カスタマイズ

`deletedAt` / `editedAt` に応じた表示切り替え:

```tsx
function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.deletedAt) {
    return <p className="text-muted">このメッセージは削除されました</p>;
  }
  if (message.editedAt) {
    return (
      <div>
        <p>{message.content}</p>
        <span className="text-xs text-muted">（編集済み）</span>
      </div>
    );
  }
  return <p>{message.content}</p>;
}
```

### useChatScreen を使わないカスタム構成

統合フックでは対応できない細かい制御が必要な場合、個別フックを組み合わせる。

```tsx
import { useChatMessages } from "@/features/chatRoom/hooks/firestore/useChatMessages";
import { useChatMessageSender } from "@/features/chatRoom/hooks/firestore/useChatMessageSender";
import { useMergedMessages } from "@/features/chatRoom/hooks/firestore/useMergedMessages";
import { useReadAt } from "@/features/chatRoom/hooks/firestore/useReadAt";

function CustomChatScreen({ roomId, uid }: { roomId: string; uid: string }) {
  const { messages, isLoading, hasMore, loadMore } = useChatMessages(roomId);
  const { sendText, sendFile, retry, dismiss, cancelUpload } = useChatMessageSender(roomId, uid);
  const { displayMessages } = useMergedMessages(roomId, messages);

  // 既読更新（latestMessageAt を渡すと滞在中も自動更新）
  const latestMessageAt = messages.length > 0 ? messages[messages.length - 1].createdAt : null;
  useReadAt(roomId, uid, { latestMessageAt });

  // ... 独自のUI構築
}
```

## API

### ChatRoom（`chat_rooms` コレクション）

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | `"direct" \| "group"` | ルーム種別。ダウンストリームで拡張可能 |
| `name` | `string \| null` | グループ名（direct は null） |
| `participants` | `string[]` | 参加者の userId 配列 |
| `participantPair` | `string \| null` | `sort([uid1, uid2]).join("_")`。direct ルームの重複防止キー |
| `readAt` | `Record<string, Date>` | `{ [userId]: 最終既読日時 }` |
| `lastMessageSnapshot` | `object` | 最新メッセージのスナップショット（一覧表示用） |
| `createdAt` / `updatedAt` | `Date` | タイムスタンプ |
| `deletedAt` | `Date \| null` | 論理削除日時（管理画面） |

#### LastMessageSnapshot

ルーム一覧画面で最新メッセージを表示するための冗長データ。
メッセージ送信時に writeBatch でアトミック更新される。

```ts
{ type: MessageType, content: string, senderId: string, createdAt: Date }
```

### ChatMessage（`chat_rooms/{roomId}/messages` サブコレクション）

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | `"text" \| "image" \| "video" \| "file" \| "system"` | メッセージ種別 |
| `content` | `string` | テキスト本文 / ファイルの ref（`storage://priv/chatRoom.<image\|video\|file>/…`。旧メッセージは旧 URL のまま） |
| `senderId` | `string` | 送信者の userId |
| `metadata` | `MessageMetadata \| null` | ファイル情報（下記参照） |
| `createdAt` | `Date` | 作成日時 |
| `editedAt` | `Date \| null` | 編集日時（未編集は null） |
| `deletedAt` | `Date \| null` | 論理削除日時（未削除は null） |

#### MessageMetadata

```ts
{ fileName: string, fileSize: number, mimeType?: string, thumbnailUrl?: string }
```

### バリデーション

- `utils/validation.ts` がサイズと、添付の許可種別(`config.ts` の `attachmentContentTypes`、上書き `src/config/features/chatRoom.config.ts`)を見る

| 項目 | 制限 |
|---|---|
| テキスト最大長 | 5,000 文字 |
| 画像最大サイズ | 10 MB |
| 動画最大サイズ | 200 MB |
| ファイル最大サイズ | 20 MB |

### 定数（constants/chat.ts）

| 定数 | デフォルト値 | 説明 |
|---|---|---|
| `MESSAGE_MAX_LENGTH` | 5000 | テキストメッセージの最大文字数 |
| `MESSAGES_PER_PAGE` | 30 | 1回のページネーションで取得する件数 |
| `MAX_PARTICIPANTS` | 30 | グループルームの最大参加者数 |
| `IMAGE_MAX_SIZE` | 10MB | 画像ファイルの最大サイズ |
| `VIDEO_MAX_SIZE` | 200MB | 動画ファイルの最大サイズ |
| `FILE_MAX_SIZE` | 20MB | 一般ファイルの最大サイズ |

## Extension

- `src/config/features/chatRoom.config.ts`: `attachmentContentTypes`(添付の種別ごとの許可 Content-Type。送信前の検査と用途 `storageObject/purposes/chatRoom.ts` が読む)

## Internals

### データフロー

```
【チャット画面】
  useChatScreen
    ├── useChatMessages ──── fetchPastMessages (初回) + subscribeNewMessages (リアルタイム)
    ├── useChatMessageSender ── sendTextMessage / sendFileMessage (writeBatch)
    ├── useMergedMessages ──── 実メッセージ + pending を時系列統合
    └── useReadAt ──────────── 入室時・新着受信時・退出時に readAt 更新

【ルーム一覧画面】
  useChatRooms ────────── subscribeRooms (リアルタイム)
  useResolvedParticipants ── 参加者の名前・アバター解決
  useUnreadCount ──────── useChatRooms + countUnreadRooms

【メッセージ送信の楽観的UIフロー】
  sendText/sendFile
    → pending 追加 (status: "sending" / "uploading") → 即座にUI表示
    → writeBatch 成功 → status: "sent"
    → onSnapshot で実メッセージ到着 → ID一致で pending 除去
    → 失敗時: status: "failed" → retry / dismiss
```

### Firestore の制約

- 複合インデックス: `where` + `orderBy` の組み合わせには必須（Usage「Firestore 複合インデックス」）
- **単一 orderBy**: Firestore は 1 クエリにつき 1 フィールドの orderBy のみ。メッセージは `createdAt` でソート
- **OR クエリなし**: 複数タイプでのフィルタが必要な場合は、クライアント側でフィルタするか購読を複数立てる

### serverTimestamp と null 安全性

`serverTimestamp()` で書き込んだフィールドは、ローカルの `onSnapshot` で先にスナップショットが発火する際に `null` になりうる。ベースの subscribe ライブラリ（`src/lib/firestore/client/subscribe.ts`）では `.data({ serverTimestamps: "estimate" })` を適用済みで、通常は `null` にならないが、日時表示は null を受けても壊れない形にする:

```tsx
<span>{room.lastMessageSnapshot?.createdAt?.toLocaleString() ?? ""}</span>
```

### writeBatch のアトミック性

メッセージ送信時は writeBatch で以下をアトミック実行する:
1. `messages` サブコレクションにメッセージ作成
2. `lastMessageSnapshot` の更新
3. 送信者の `readAt` の更新

これにより、ルーム一覧で最新メッセージが常に正しく表示され、送信者自身に未読バッジが付くことを防ぐ。

### 設計判断

#### lastMessageSnapshot をクライアント writeBatch で更新する（Cloud Functions トリガーを使わない）

- メッセージ作成と snapshot 更新が同一バッチでアトミックに確定し、送信直後に一覧へ反映される（Functions トリガーは非同期で遅延が出る）
- 整合性はセキュリティルールのフィールド検証で強制できる
- CLAUDE.md BACKENDS doctrine の「Firebase Functions にロジックを置かない」とも一致する

#### 未読管理を chatRoom 内の `readAt` map に統合する

- 一覧購読だけで未読判定が完結し、ルームごとの追加読取が発生しない
- `readAt` の更新はチャット画面側（`useReadAt` の入室・滞在中の新着・退出時）と自分の送信時のみ。一覧のリアルタイムリスナーでは更新しない（書き込みコスト抑制）
- 代償: 参加者が多いと同一ドキュメントへの同時書き込み競合が起きうる。`MAX_PARTICIPANTS`（30）程度では実害はない
- 100 人超のグループでは `chat_rooms/{roomId}/members/{userId}` サブコレクションへ readAt を分けると書き込み競合を避けられる（一覧での未読判定が追加読取になる）

#### タイピング表示（未実装）は Realtime Database の物

- Firestore は書き込み回数課金で、数秒おきに発生する typing 状態更新には不向き。RTDB は高頻度な小さい値の更新に向き、`onDisconnect` で切断時の自動クリアもできる
- 構造案: `chatTyping/{roomId}/{userId}: { isTyping, updatedAt }`。クライアント側で `updatedAt` が数秒以上古ければ表示しないフェイルセーフを入れる
- 上流は RTDB を入れていない

#### セキュリティルールの方針

- 例を `src/features/core/chatRoom/firestore.rules.example` に同梱。fork が自分の `firestore.rules` に足してデプロイする
- ブラウザが `chat_rooms` と `messages` を直接読み書きするので、ルールが唯一の守り。手順は docs/setup/Neon_Firebaseなど各種バックエンドサービスの設定方法.md §6.2
- 例は `request.auth.uid` == `users.id`（participants・senderId・readAt のキー）を前提にする。chatRoom のクライアントはどのログイン方法でもこれを満たす（「chatRoom 専用の Firebase アプリ」）
- 例は chatRoom のクライアントが書くフィールドと type（direct / group）だけを通す。独自フィールド・独自の type を使う fork は、自分の `firestore.rules` に足す

セキュリティルールの書き方:

- ルールはドキュメント単位で評価されるため、各ドキュメントのフィールド値検証で制約を担保する
- `chat_rooms` の update は 1 つの allow 式で「どのフィールドが変わったか」を分岐判定する。少なくとも次の経路を区別する:
  - 既読更新: `readAt` の自分のキーのみ変更
  - メッセージ送信: `lastMessageSnapshot` / `updatedAt` / 自分の `readAt` のみ変更、かつ `lastMessageSnapshot.senderId == request.auth.uid`、`content` が `MESSAGE_MAX_LENGTH` 以内
  - 編集（最新メッセージ時）: `lastMessageSnapshot.content` / `updatedAt` のみ変更
  - 参加者管理・ルーム名変更等: 用途に応じた権限条件
- `messages` は親ルームの `participants` に含まれることを read/create の条件にし、create は `senderId == request.auth.uid`。編集・論理削除を使う場合は送信者本人のみに update を許可する
- チャット添付は Firebase Storage を使わない（「ファイル添付」。発行と読み取りはアプリのサーバーが participants で判定する）

#### chatRoom 専用の Firebase アプリ

- chatRoom のクライアント（`services/client/firestoreClient.ts` / `messageClient.ts`）は、既定のアプリではなく chatRoom 専用のアプリ（名前 `"chatRoom"`、`services/client/chatFirebase.ts`）の Firestore を使う
- 専用のアプリはカスタムトークン（`/api/auth/firebase-token`。uid = `users.id`）でサインインし、読み書き・購読の前にそれを待つ。認証の状態はメモリにだけ持つ（ページの読み込みごとにトークンを 1 回取る）
- 理由: メール+パスワード・OAuth でログインすると、既定のアプリの uid はプロバイダーの uid のまま（`users.id` と違う）で、ルールで chatRoom の読み書きがすべて拒否される。既定のアプリ（ログイン・電話番号の紐づけ・パスワード変更）は入れ替えない
- 専用のアプリは chatRoom の内側だけの部品で、公開の入口ではない

### ファイル添付

- `sendFile` は種類ごとの用途 `chatRoom.image` / `chatRoom.video` / `chatRoom.file`（private）に `scopeId = roomId` で上げ、`content` に ref を入れる（用途: storageObject/purposes/chatRoom.ts）
  - 上げられるのも読めるのも、そのルームの現参加者だけ（`isChatParticipant`）。退室すると次の読み取りから署名が出ない
  - チャットの用途は業務行に紐付けない（`attach: false`）。送信済みの添付は掃除の対象外
  - 送信に失敗した添付は `dismiss` / `cancelUpload` / `retry`（再アップロード）のときに取り消す（discard）。送信済みのものは取り消さない
- 表示は `resolveStorageSrc(content)`（`@/lib/storage`）で固定 URL `/api/storage/objects/<id>` にする。`content` が旧 URL（http(s)）ならそのまま返る
  - 画像: `<AppImage src={message.content} … />`（ref をそのまま渡せる。非公開は最適化を通らない）
  - 動画: `<AppVideo src={message.content} />`（`@/components/Media/AppVideo`。ref をそのまま渡せる。期限後の再読み込みは自動）。入力欄の下見は `VideoPreview`（lib/mediaInputSuite、中身は AppVideo）。AppVideo を使えない自前のプレイヤーだけ `usePrivateMediaRecovery`（src/lib/storage/README.md）
  - ファイル: `<a href={resolveStorageSrc(message.content)}>`（配信は attachment）
- `lastMessageSnapshot.content` にも ref が入る。ルーム一覧のプレビューは `type` で「画像」「動画」「ファイル」などに出し分ける（ref を文字として出さない）

### 未読判定のロジック

`isRoomUnread(room, uid)` は以下の条件で未読と判定する:
1. `lastMessageSnapshot.createdAt` が存在する
2. `lastMessageSnapshot.senderId` が自分ではない（自分の送信は未読にしない）
3. `readAt[uid]` が未設定、または `lastMessageSnapshot.createdAt > readAt[uid]`

### 楽観的UI

- メッセージ ID は送信前に `generateMessageId` で事前生成し、pending と実メッセージの照合に使用する
- pending 状態は Zustand ストア（`stores/messageSending/`）でルームごとに管理
- `useMergedMessages` が実メッセージ到着時に ID 一致で pending を自動除去

## Related

- `hooks/firestore/README.md`: Firestore のフック(統合 Hook・個別 Hook)のリファレンス
- `services/client/README.md`: ルーム・メッセージ・一斉送信のクライアント関数
- ルール例: `firestore.rules.example`、手順: docs/setup/Neon_Firebaseなど各種バックエンドサービスの設定方法.md §6.2
