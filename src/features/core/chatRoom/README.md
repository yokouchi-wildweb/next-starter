# chatRoom ドメイン

Firestore ベースのリアルタイムチャット機能を提供するコアドメイン。
ダウンストリームプロジェクトはこのベースレイヤーの上に、プロジェクト固有の UI や拡張機能を構築する。

---

## 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [セットアップ](#セットアップ)
3. [データモデル](#データモデル)
4. [クイックスタート](#クイックスタート)
5. [Hook リファレンス](#hook-リファレンス)
6. [Service リファレンス](#service-リファレンス)
7. [拡張パターン](#拡張パターン)
8. [設計上の注意点](#設計上の注意点)

---

## アーキテクチャ概要

チャット機能は **リアルタイム性** が求められるため、通常のドメインと異なり REST API を経由せず
Firestore SDK を直接操作する。管理画面向けには自動生成の CRUD（API 経由）も並行して存在する。

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
└──────────────┬──────────────────────────────────────────────┘
               │ Firestore SDK
┌─ Firestore ──┴──────────────────────────────────────────────┐
│  chat_rooms/{roomId}                                         │
│  chat_rooms/{roomId}/messages/{messageId}                     │
└──────────────────────────────────────────────────────────────┘
```

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

---

## セットアップ

### Firestore 複合インデックス（必須）

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

---

## データモデル

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

#### LastMessageSnapshot

ルーム一覧画面で最新メッセージを表示するための冗長データ。
メッセージ送信時に writeBatch でアトミック更新される。

```ts
{ type: MessageType, content: string, senderId: string, createdAt: Date }
```

### ChatMessage（`chat_rooms/{roomId}/messages` サブコレクション）

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | `"text" \| "image" \| "file" \| "system"` | メッセージ種別 |
| `content` | `string` | テキスト本文 / ファイル URL |
| `senderId` | `string` | 送信者の userId |
| `metadata` | `MessageMetadata \| null` | ファイル情報（下記参照） |
| `createdAt` | `Date` | 作成日時 |
| `editedAt` | `Date \| null` | 編集日時（未編集は null） |
| `deletedAt` | `Date \| null` | 論理削除日時（未削除は null） |

#### MessageMetadata

```ts
{ fileName: string, fileSize: number, mimeType?: string, thumbnailUrl?: string }
```

---

## クイックスタート

### チャット画面（最小構成）

`useChatScreen` を使えば、メッセージ取得・送信・楽観的 UI・既読更新を一行で接続できる。

```tsx
import { useChatScreen } from "@/features/chatRoom/hooks/firestore/useChatScreen";

function ChatScreen({ roomId, uid }: { roomId: string; uid: string }) {
  const {
    displayMessages, isLoading, hasMore, loadMore,
    sendText, sendFile, retry, dismiss, cancelUpload,
  } = useChatScreen(roomId, uid);

  return (
    <div>
      {hasMore && <button onClick={loadMore}>過去のメッセージを読み込む</button>}

      {displayMessages.map((dm) => (
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
      ))}

      <MessageInput onSendText={sendText} onSendFile={sendFile} />
    </div>
  );
}
```

> `useChatScreen` の内部構成: `useChatMessages` + `useChatMessageSender` + `useMergedMessages` + `useReadAt`。
> カスタムな接続が必要な場合は個別フックを直接使用する。

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
            <p>{room.lastMessageSnapshot?.content}</p>
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

---

## Hook リファレンス

### 統合 Hook

通常はこれらを使えば十分。個別 Hook は細かい制御が必要な場合に使用する。

#### `useChatScreen(roomId, uid)`

チャット画面に必要な全機能をまとめて提供する。

| パラメータ | 型 | 説明 |
|---|---|---|
| `roomId` | `string \| null` | ルーム ID |
| `uid` | `string \| null` | ログインユーザーの ID |

| 戻り値 | 型 | 説明 |
|---|---|---|
| `displayMessages` | `DisplayMessage[]` | 時系列順の統合メッセージ一覧（実 + pending） |
| `isLoading` | `boolean` | 初回読み込み中 |
| `isLoadingMore` | `boolean` | 過去メッセージ読み込み中 |
| `hasMore` | `boolean` | さらに過去のメッセージがあるか |
| `error` | `Error \| null` | エラー |
| `loadMore` | `() => Promise<void>` | 過去メッセージを追加取得 |
| `sendText` | `(content: string) => Promise<ValidationResult>` | テキストメッセージ送信 |
| `sendFile` | `(file: File, type: "image" \| "file") => ValidationResult` | ファイル/画像送信 |
| `retry` | `(pendingId: string) => Promise<void>` | 失敗メッセージの再送 |
| `dismiss` | `(pendingId: string) => void` | 失敗メッセージの破棄 |
| `cancelUpload` | `(pendingId: string) => void` | アップロードキャンセル |

#### `useUnreadCount(uid, options?)`

未読ルーム数をリアルタイムで返す。

| パラメータ | 型 | 説明 |
|---|---|---|
| `uid` | `string \| null` | ログインユーザーの ID |
| `options?.type` | `ChatRoomType` | ルームタイプで絞り込み（省略時は全タイプ） |

| 戻り値 | 型 |
|---|---|
| `number` | 未読ルーム数 |

### 個別 Hook

#### `useChatRooms(uid, options?)`

ユーザーが参加しているルーム一覧をリアルタイム購読する。

| パラメータ | 型 | 説明 |
|---|---|---|
| `uid` | `string \| null` | ログインユーザーの ID |
| `options?.type` | `ChatRoomType` | ルームタイプで絞り込み |

| 戻り値 | 型 | 説明 |
|---|---|---|
| `rooms` | `ChatRoom[]` | ルーム一覧（`lastMessageSnapshot.createdAt` 降順） |
| `isLoading` | `boolean` | 初回読み込み中 |
| `error` | `Error \| null` | エラー |

#### `useChatRoomSubscription(roomId)`

単一ルームのドキュメントをリアルタイム購読する。チャット画面でルーム情報（参加者・readAt 等）を表示する際に使用。

| パラメータ | 型 | 説明 |
|---|---|---|
| `roomId` | `string \| null` | ルーム ID |

| 戻り値 | 型 | 説明 |
|---|---|---|
| `room` | `ChatRoom \| null` | ルーム情報 |
| `isLoading` | `boolean` | 初回読み込み中 |
| `error` | `Error \| null` | エラー |

#### `useChatMessages(roomId)`

過去メッセージの取得（ページネーション）+ 新着メッセージのリアルタイム購読を行う。

| パラメータ | 型 | 説明 |
|---|---|---|
| `roomId` | `string \| null` | ルーム ID |

| 戻り値 | 型 | 説明 |
|---|---|---|
| `messages` | `ChatMessage[]` | メッセージ一覧（古い → 新しい順） |
| `isLoading` | `boolean` | 初回読み込み中 |
| `isLoadingMore` | `boolean` | 過去メッセージ読み込み中 |
| `hasMore` | `boolean` | さらに過去のメッセージがあるか |
| `error` | `Error \| null` | エラー |
| `loadMore` | `() => Promise<void>` | 過去メッセージを追加取得 |

動作: マウント時に最新30件を取得 → 以降の新着をリアルタイム購読。`loadMore` で過去方向にカーソルベースでページネーション。

#### `useChatMessageSender(roomId, uid)`

メッセージ送信と楽観的 UI を管理する。

| パラメータ | 型 | 説明 |
|---|---|---|
| `roomId` | `string \| null` | ルーム ID |
| `uid` | `string \| null` | 送信者の ID |

| 戻り値 | 型 | 説明 |
|---|---|---|
| `pendingMessages` | `PendingMessage[]` | 送信中/失敗のメッセージ一覧 |
| `sendText` | `(content: string) => Promise<ValidationResult>` | テキスト送信 |
| `sendFile` | `(file: File, type: "image" \| "file") => ValidationResult` | ファイル送信 |
| `retry` | `(pendingId: string) => Promise<void>` | 再送 |
| `dismiss` | `(pendingId: string) => void` | 破棄 |
| `cancelUpload` | `(pendingId: string) => void` | アップロードキャンセル |

#### `useMergedMessages(roomId, messages)`

実メッセージと pending メッセージを統合して、UI 表示用のリストを生成する。

| パラメータ | 型 | 説明 |
|---|---|---|
| `roomId` | `string \| null` | ルーム ID |
| `messages` | `ChatMessage[]` | 実メッセージ一覧 |

| 戻り値 | 型 | 説明 |
|---|---|---|
| `displayMessages` | `DisplayMessage[]` | 統合メッセージ一覧 |

```ts
type DisplayMessage = {
  message: ChatMessage;
  sendingStatus?: MessageSendingStatus; // 実メッセージは undefined
  uploadProgress?: UploadProgress;
  isPending: boolean;
};
```

#### `useReadAt(roomId, uid, options?)`

既読時刻を自動更新する。画面に配置するだけで動作する。

| パラメータ | 型 | 説明 |
|---|---|---|
| `roomId` | `string \| null` | ルーム ID |
| `uid` | `string \| null` | ログインユーザーの ID |
| `options?.latestMessageAt` | `Date \| null` | 最新メッセージの日時（滞在中の更新トリガー） |

動作:
- **入室時**: 初回マウント時に `readAt` を更新
- **滞在中**: `latestMessageAt` が変化するたびに 1 秒デバウンスで更新
- **退出時**: アンマウント時に `readAt` を更新

#### `useResolvedParticipants(rooms, currentUid, resolver)`

ルーム一覧の参加者プロフィールをバッチ取得する。

| パラメータ | 型 | 説明 |
|---|---|---|
| `rooms` | `ChatRoom[]` | ルーム一覧 |
| `currentUid` | `string \| null` | 自分の UID（除外される） |
| `resolver` | `ParticipantResolver` | UID → プロフィール変換関数 |

| 戻り値 | 型 | 説明 |
|---|---|---|
| `profileMap` | `Map<string, ParticipantProfile>` | UID → プロフィールのマップ |
| `isLoading` | `boolean` | 取得中 |

```ts
type ParticipantProfile = { name: string; avatarUrl?: string };
type ParticipantResolver = (uids: string[]) => Promise<Map<string, ParticipantProfile>>;
```

> resolver はダウンストリームで実装する。全ルームの UID を一意に収集し、resolver を1回だけ呼ぶ。
> rooms が更新された際は未取得の UID のみ差分取得する。

---

## Service リファレンス

### ルーム操作（firestoreClient.ts）

#### ルーム作成

```ts
// ダイレクトルーム（既存ルームがあればそれを返す）
const { roomId, alreadyExists } = await createDirectRoom({
  myUid: currentUser.uid,
  otherUid: targetUser.uid,
});

// グループルーム
const { roomId } = await createGroupRoom({
  myUid: currentUser.uid,
  participants: [currentUser.uid, user2.uid, user3.uid],
  name: "プロジェクトA",
});
```

#### カスタムルーム作成

ダウンストリームで独自の `type` を持つルームを作成する場合:

```ts
import {
  createRoomWithSystemMessage,
  buildParticipantPair,
} from "@/features/chatRoom/services/client/firestoreClient";

const { roomId } = await createRoomWithSystemMessage({
  roomId: doc(collection(fstore, "chat_rooms")).id,
  type: "scout" as any,
  name: null,
  participants: [recruiterUid, targetUid],
  participantPair: buildParticipantPair(recruiterUid, targetUid),
  senderId: recruiterUid,
});
```

#### 参加者管理

```ts
import { addParticipant, removeParticipant } from "@/features/chatRoom/services/client/firestoreClient";

// 追加（システムメッセージ「{name}が参加しました」を自動作成）
await addParticipant({ roomId, uid: newUser.uid, operatorUid: currentUser.uid, displayName: newUser.name });

// 退出（readAt 削除 + システムメッセージ）
await removeParticipant({ roomId, uid: leavingUser.uid, operatorUid: currentUser.uid, displayName: leavingUser.name });
```

#### 既読更新

```ts
import { updateReadAt } from "@/features/chatRoom/services/client/firestoreClient";

// 手動で既読更新（通常は useReadAt が自動で行う）
await updateReadAt(roomId, uid);
```

### メッセージ操作（messageClient.ts）

#### 送信

通常は `useChatMessageSender` 経由で呼ばれるが、直接使用も可能。

```ts
import { sendTextMessage, sendFileMessage, generateMessageId } from "@/features/chatRoom/services/client/messageClient";

// テキスト
const messageId = await sendTextMessage({ roomId, content: "Hello", senderId: uid });

// ファイル（アップロード済みURLを渡す）
const messageId = await sendFileMessage({
  roomId, content: downloadUrl, type: "image", senderId: uid,
  metadata: { fileName: "photo.jpg", fileSize: 1024 },
});
```

> 送信時は writeBatch で `messages` 作成 + `lastMessageSnapshot` 更新 + `readAt` 更新をアトミック実行する。

#### 編集

```ts
import { editMessage } from "@/features/chatRoom/services/client/messageClient";

await editMessage({
  roomId,
  messageId,
  content: "修正後のテキスト",
  senderId: uid,
  isLatestMessage: true, // 最新メッセージなら lastMessageSnapshot も同時更新
});
```

#### 削除（論理削除）

```ts
import { deleteMessage } from "@/features/chatRoom/services/client/messageClient";

await deleteMessage({ roomId, messageId });
// → deletedAt が設定される。lastMessageSnapshot は変更しない
```

#### 過去メッセージ取得

```ts
import { fetchPastMessages } from "@/features/chatRoom/services/client/messageClient";

const { messages, nextCursor, hasMore } = await fetchPastMessages(roomId);
// 次ページ: await fetchPastMessages(roomId, nextCursor);
```

### 未読ユーティリティ（utils/unread.ts）

```ts
import { isRoomUnread, countUnreadRooms } from "@/features/chatRoom/utils/unread";

isRoomUnread(room, uid);      // 最新メッセージが自分の送信なら false
countUnreadRooms(rooms, uid); // 未読ルーム数
```

---

## 拡張パターン

### カスタムルームタイプ

`type` フィールドを拡張してプロジェクト固有のチャット種別を追加できる。

```tsx
// ルームタイプ別のフィルタリング
const { rooms } = useChatRooms(uid, { type: "scout" as any });

// 未読数もタイプ別に取得可能
const scoutUnread = useUnreadCount(uid, { type: "scout" as any });
```

> タイプフィルタを使用する場合は、対応する複合インデックスが必要（[セットアップ](#セットアップ)参照）。

### ルームへの独自フィールド追加

Firestore はスキーマレスのため、コアファイルの変更なしに独自フィールドを追加できる。

```ts
// 書き込み
await updateDoc(doc(fstore, "chat_rooms", roomId), {
  iconUrl: "https://...",
  description: "プロジェクトAの相談部屋",
});

// 読み取り（型拡張）
type ExtendedChatRoom = ChatRoom & { iconUrl?: string; description?: string };
```

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

---

## 設計上の注意点

### Firestore の制約

- **複合インデックス**: `where` + `orderBy` の組み合わせには必須（[セットアップ](#セットアップ)参照）
- **単一 orderBy**: Firestore は 1 クエリにつき 1 フィールドの orderBy のみ。メッセージは `createdAt` でソート
- **OR クエリなし**: 複数タイプでのフィルタが必要な場合は、クライアント側でフィルタするか購読を複数立てる

### serverTimestamp と null 安全性

`serverTimestamp()` で書き込んだフィールドは、ローカルの `onSnapshot` で先にスナップショットが発火する際に `null` になりうる。ベースの subscribe ライブラリ（`src/lib/firestore/client/subscribe.ts`）では `.data({ serverTimestamps: "estimate" })` を適用済みで、通常は `null` にならないが、日時表示では防御的にハンドリングすることを推奨。

```tsx
<span>{room.lastMessageSnapshot?.createdAt?.toLocaleString() ?? ""}</span>
```

### writeBatch のアトミック性

メッセージ送信時は writeBatch で以下をアトミック実行する:
1. `messages` サブコレクションにメッセージ作成
2. `lastMessageSnapshot` の更新
3. 送信者の `readAt` の更新

これにより、ルーム一覧で最新メッセージが常に正しく表示され、送信者自身に未読バッジが付くことを防ぐ。

### 未読判定のロジック

`isRoomUnread(room, uid)` は以下の条件で未読と判定する:
1. `lastMessageSnapshot.createdAt` が存在する
2. `lastMessageSnapshot.senderId` が自分ではない（自分の送信は未読にしない）
3. `readAt[uid]` が未設定、または `lastMessageSnapshot.createdAt > readAt[uid]`

### 楽観的UI

- メッセージ ID は送信前に `generateMessageId` で事前生成し、pending と実メッセージの照合に使用する
- pending 状態は Zustand ストア（`stores/messageSending/`）でルームごとに管理
- `useMergedMessages` が実メッセージ到着時に ID 一致で pending を自動除去

### バリデーション

`utils/validation.ts` でサイズのみをチェック。ファイルタイプの制限はアップストリームでは行わない（ダウンストリームで必要に応じて追加する）。

| 項目 | 制限 |
|---|---|
| テキスト最大長 | 5,000 文字 |
| 画像最大サイズ | 10 MB |
| ファイル最大サイズ | 20 MB |

### 定数（constants/chat.ts）

| 定数 | デフォルト値 | 説明 |
|---|---|---|
| `MESSAGE_MAX_LENGTH` | 5000 | テキストメッセージの最大文字数 |
| `MESSAGES_PER_PAGE` | 30 | 1回のページネーションで取得する件数 |
| `MAX_PARTICIPANTS` | 30 | グループルームの最大参加者数 |
| `IMAGE_MAX_SIZE` | 10MB | 画像ファイルの最大サイズ |
| `FILE_MAX_SIZE` | 20MB | 一般ファイルの最大サイズ |

### ファイル構成

```
chatRoom/
├── entities/
│   ├── message.ts          # ChatMessage, ChatRoomType, MessageMetadata 等（手動）
│   ├── firestore.ts        # collectionPath（自動生成）
│   ├── model.ts            # ChatRoom 型（自動生成）
│   └── schema.ts / form.ts # Zod スキーマ / フォーム型（自動生成）
│
├── constants/
│   └── chat.ts             # メッセージ上限、ファイルサイズ、システムメッセージ等（手動）
│
├── services/client/
│   ├── firestoreClient.ts  # ルーム作成・購読・参加者管理（手動）
│   ├── messageClient.ts    # メッセージ送信・編集・削除・取得・購読（手動）
│   └── chatRoomClient.ts   # REST API クライアント（自動生成・管理画面用）
│
├── hooks/firestore/        # Firestore リアルタイム用フック（手動）
│   ├── useChatScreen.ts         ← 統合Hook: チャット画面の全機能
│   ├── useUnreadCount.ts        ← 統合Hook: 未読ルーム数
│   ├── useChatRooms.ts
│   ├── useChatRoomSubscription.ts
│   ├── useChatMessages.ts
│   ├── useChatMessageSender.ts
│   ├── useMergedMessages.ts
│   ├── useReadAt.ts
│   └── useResolvedParticipants.ts
│
├── hooks/                  # CRUD フック（自動生成・管理画面用）
│
├── stores/messageSending/  # 送信状態管理 Zustand ストア（手動）
│   ├── types.ts            # PendingMessage, MessageSendingStatus
│   ├── internalStore.ts
│   ├── useStore.ts
│   └── index.ts
│
├── utils/
│   ├── unread.ts           # isRoomUnread, countUnreadRooms
│   └── validation.ts       # メッセージ/ファイルのバリデーション
│
└── components/             # 管理画面コンポーネント（自動生成）
```

> **手動** = ダウンストリームでカスタマイズ可能 | **自動生成** = `dc:generate` で生成、直接編集しない

### 将来の拡張

以下は現在未実装だが、既存構造を破壊せずに追加可能:

- **リプライ**: `ChatMessage` に `replyTo: { messageId, content, senderId }` を追加
- **メンション**: `ChatMessage` に `mentions: string[]` を追加
- **リアクション**: サブコレクション `messages/{messageId}/reactions` を新設
- **タイピング表示**: 別コレクション or Realtime Database を使用
- **既読レシート**: 既存の `readAt` マップを活用
