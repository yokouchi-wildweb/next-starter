# chatRoom ドメイン

Firestore ベースのリアルタイムチャット機能を提供するコアドメイン。
ダウンストリームプロジェクトはこのベースレイヤーの上に、プロジェクト固有のUIや拡張機能を構築する。

## 目次

- [アーキテクチャ概要](#アーキテクチャ概要)
- [データ構造](#データ構造)
- [ファイル構成](#ファイル構成)
- [基本的な使い方](#基本的な使い方)
- [拡張パターン](#拡張パターン)
- [設計上の制約と注意点](#設計上の制約と注意点)

---

## アーキテクチャ概要

```
┌─ Hook 層 ──────────────────────────────────────────────┐
│  useChatRooms          ルーム一覧のリアルタイム購読      │
│  useChatRoomSubscription  単一ルームのリアルタイム購読   │
│  useChatMessages       メッセージ取得 + 新着購読         │
│  useChatMessageSender  メッセージ送信（楽観的UI付き）    │
│  useMergedMessages     実メッセージ + pending の統合     │
│  useReadAt             既読更新                         │
└──────────────┬─────────────────────────────────────────┘
               │ 直接呼び出し（HTTP を経由しない）
┌─ Service 層 ─┴────────────────────────────────────────┐
│  firestoreClient.ts    ルーム操作（作成・購読・参加者）  │
│  messageClient.ts      メッセージ操作（送信・編集・削除）│
└──────────────┬─────────────────────────────────────────┘
               │ Firestore SDK
┌─ Firestore ──┴────────────────────────────────────────┐
│  chat_rooms/{roomId}                                   │
│  chat_rooms/{roomId}/messages/{messageId}               │
└────────────────────────────────────────────────────────┘
```

チャット機能は **リアルタイム性** が求められるため、通常のドメインと異なり REST API を経由せず Firestore SDK を直接操作する。
管理画面向けには自動生成の CRUD（API 経由）も並行して存在する。

---

## データ構造

### ChatRoom（`chat_rooms` コレクション）

| フィールド | 型 | 説明 |
|---|---|---|
| type | `"direct" \| "group"` | ルーム種別。ダウンストリームで拡張可能 |
| name | `string \| null` | グループ名（direct は null） |
| participants | `string[]` | 参加者の userId 配列 |
| participantPair | `string \| null` | `sort([uid1, uid2]).join("_")`。direct ルームの重複防止キー |
| readAt | `Record<string, Date>` | `{ [userId]: 最終既読日時 }` |
| lastMessageSnapshot | `LastMessageSnapshot` | 最新メッセージのスナップショット（一覧表示用） |
| createdAt / updatedAt | `Date` | タイムスタンプ |

### ChatMessage（`chat_rooms/{roomId}/messages` サブコレクション）

| フィールド | 型 | 説明 |
|---|---|---|
| type | `"text" \| "image" \| "file" \| "system"` | メッセージ種別 |
| content | `string` | テキスト本文 / ファイル URL |
| senderId | `string` | 送信者の userId |
| metadata | `MessageMetadata \| null` | ファイル情報（fileName, fileSize, mimeType 等） |
| createdAt | `Date` | 作成日時 |
| editedAt | `Date \| null` | 編集日時（未編集は null） |
| deletedAt | `Date \| null` | 論理削除日時（未削除は null） |

### LastMessageSnapshot

ルーム一覧画面で最新メッセージを表示するための冗長データ。
メッセージ送信時に writeBatch でアトミック更新される。

```ts
{ type, content, senderId, createdAt }
```

---

## ファイル構成

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
│   ├── useChatRooms.ts
│   ├── useChatRoomSubscription.ts
│   ├── useChatMessages.ts
│   ├── useChatMessageSender.ts
│   ├── useMergedMessages.ts
│   ├── useReadAt.ts
│   ├── useResolvedParticipants.ts
│   ├── useUnreadCount.ts
│   └── useChatScreen.ts
│
├── hooks/                  # CRUD フック（自動生成・管理画面用）
│   ├── useChatRoom.ts
│   ├── useChatRoomList.ts
│   └── ...
│
├── stores/messageSending/  # 送信状態管理 Zustand ストア（手動）
│   ├── types.ts            # PendingMessage, MessageSendingStatus
│   ├── internalStore.ts    # Zustand create
│   ├── useStore.ts         # roomId スコープの Hook ラッパー
│   └── index.ts
│
├── utils/
│   ├── unread.ts           # isRoomUnread(room, uid)
│   └── validation.ts       # メッセージ/ファイルのバリデーション
│
└── components/             # 管理画面コンポーネント（自動生成）
```

> **手動** = ダウンストリームで必要に応じてカスタマイズ可能
> **自動生成** = `dc:generate` で生成。直接編集しない

---

## 基本的な使い方

### 1. ルーム一覧の表示（参加者プロフィール付き）

```tsx
import { useChatRooms } from "@/features/chatRoom/hooks/firestore/useChatRooms";
import { useResolvedParticipants } from "@/features/chatRoom/hooks/firestore/useResolvedParticipants";
import { isRoomUnread } from "@/features/chatRoom/utils/unread";

function ChatRoomList({ uid }: { uid: string }) {
  const { rooms, isLoading } = useChatRooms(uid);

  // 参加者プロフィールの解決（resolver はプロジェクトの User モデルに合わせて実装）
  const { profileMap } = useResolvedParticipants(rooms, uid, async (uids) => {
    const users = await fetchUsersByIds(uids); // ダウンストリームの API
    return new Map(users.map((u) => [u.id, { name: u.name, avatarUrl: u.avatarUrl }]));
  });

  return (
    <ul>
      {rooms.map((room) => {
        // direct ルームの場合、相手のプロフィールを取得
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

> **resolver の実装**: `useResolvedParticipants` はプロジェクトの User モデルに依存しないため、
> resolver 関数でプロジェクト固有のユーザー取得ロジックを注入する。
> 内部で全ルームの UID を一意に収集し、resolver を1回だけバッチ呼び出しする。
> rooms が更新された際は未取得の UID のみ差分取得する。

### 2. チャット画面

`useChatScreen` でメッセージ取得・送信・楽観的UI・既読更新をまとめて接続できる。

```tsx
import { useChatScreen } from "@/features/chatRoom/hooks/firestore/useChatScreen";
import { useChatRoomSubscription } from "@/features/chatRoom/hooks/firestore/useChatRoomSubscription";

function ChatScreen({ roomId, uid }: { roomId: string; uid: string }) {
  // ルーム情報のリアルタイム購読（参加者・readAt 等）
  const { room } = useChatRoomSubscription(roomId);

  // メッセージ・送信・既読を統合
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

> 個別フック（`useChatMessages`, `useChatMessageSender`, `useMergedMessages`, `useReadAt`）を
> 直接使うこともできる。カスタムな接続が必要な場合はそちらを使用する。

### 3. ルーム作成

```tsx
import {
  createDirectRoom,
  createGroupRoom,
} from "@/features/chatRoom/services/client/firestoreClient";

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

### 4. メッセージ編集・削除

```tsx
import { editMessage, deleteMessage } from "@/features/chatRoom/services/client/messageClient";

// 編集（最新メッセージかどうかで lastMessageSnapshot の同時更新を制御）
await editMessage({
  roomId,
  messageId,
  content: "修正後のテキスト",
  senderId: uid,
  isLatestMessage: true, // 呼び出し側で判定
});

// 論理削除（lastMessageSnapshot は変更しない）
await deleteMessage({ roomId, messageId });
```

### 5. 参加者管理（グループルーム）

```tsx
import {
  addParticipant,
  removeParticipant,
} from "@/features/chatRoom/services/client/firestoreClient";

// 参加者追加（システムメッセージ「{name}が参加しました」を自動作成）
await addParticipant({
  roomId,
  uid: newUser.uid,
  operatorUid: currentUser.uid,
  displayName: newUser.name,
});

// 参加者退出（readAt エントリ削除 + システムメッセージ作成）
await removeParticipant({
  roomId,
  uid: leavingUser.uid,
  operatorUid: currentUser.uid,
  displayName: leavingUser.name,
});
```

---

## 拡張パターン

### カスタムルームタイプの追加

`type` フィールドを拡張して、プロジェクト固有のチャット種別を追加できる。

```tsx
// ダウンストリームでスカウト用ルームを作成する例
import {
  createRoomWithSystemMessage,
  buildParticipantPair,
} from "@/features/chatRoom/services/client/firestoreClient";

const { roomId } = await createRoomWithSystemMessage({
  roomId: generateId(), // doc(collection(...)).id
  type: "scout" as any, // ChatRoomType を拡張
  name: null,
  participants: [recruiterUid, targetUid],
  participantPair: buildParticipantPair(recruiterUid, targetUid),
  senderId: recruiterUid,
});
```

### ルームタイプ別のフィルタリング

ルーム一覧をタイプで絞り込む。大規模プロジェクトで複数種類のチャットが共存する場合に有用。

```tsx
// 通常チャットのみ
const { rooms } = useChatRooms(uid, { type: "direct" });

// スカウトチャットのみ
const { rooms } = useChatRooms(uid, { type: "scout" as any });
```

### ルームへの独自フィールド追加

Firestore はスキーマレスのため、ダウンストリームでルームドキュメントに独自フィールドを自由に追加できる。コアファイルの変更は不要。

```tsx
// 例: ルームにアイコン URL を追加
import { updateDoc } from "@/lib/firestore/client";
import { doc } from "firebase/firestore";

await updateDoc(doc(fstore, "chat_rooms", roomId), {
  iconUrl: "https://...",
  description: "プロジェクトAの相談部屋",
});
```

読み取り時は `ChatRoom` の型を拡張するか、`as` でキャストして使用する。

```tsx
type ExtendedChatRoom = ChatRoom & {
  iconUrl?: string;
  description?: string;
};
```

### メッセージの表示カスタマイズ

`deletedAt` が設定されたメッセージは論理削除済み。表示側でハンドリングする。

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

---

## セットアップ

### 必須: Firestore 複合インデックスの作成

チャット機能を使用するには、Firebase コンソールで以下の複合インデックスを作成する必要がある。
これがないとルーム一覧の購読（`subscribeRooms`）でエラーになる。

**ルーム一覧用（必須）**

| 項目 | 値 |
|---|---|
| コレクション ID | `chat_rooms` |
| フィールド 1 | `participants` — Arrays |
| フィールド 2 | `lastMessageSnapshot.createdAt` — Descending |
| クエリのスコープ | コレクション |

**ルームタイプフィルタ用（`subscribeRooms` で `type` オプションを使用する場合）**

| 項目 | 値 |
|---|---|
| コレクション ID | `chat_rooms` |
| フィールド 1 | `type` — Ascending |
| フィールド 2 | `participants` — Arrays |
| フィールド 3 | `lastMessageSnapshot.createdAt` — Descending |
| クエリのスコープ | コレクション |

> **作成方法**: Firebase コンソール → Firestore Database → インデックス → 複合インデックスを作成。
> または、インデックスが未作成の状態でクエリを実行するとブラウザのコンソールにインデックス作成用の直リンクが表示されるので、それをクリックして作成することもできる。

---

## 設計上の制約と注意点

### Firestore の制約

- **複合インデックス**: 上記「セットアップ」セクションを参照。`where` + `orderBy` の組み合わせには複合インデックスが必須
- **単一 orderBy**: Firestore は1クエリにつき1フィールドの orderBy のみ。メッセージは `createdAt` でソート
- **OR クエリなし**: 複数タイプでのフィルタが必要な場合は、クライアント側でフィルタするか購読を複数立てる

### serverTimestamp と null 安全性

`serverTimestamp()` で書き込んだフィールドは、ローカルの `onSnapshot` で先にローカルスナップショットが発火する際、サーバーからの確定値が未到着で `null` になりうる。

ベースの subscribe ライブラリ（`src/lib/firestore/client/subscribe.ts`）では `.data({ serverTimestamps: "estimate" })` を適用済みで、クライアントの推定時刻が自動的に埋められる。そのため通常は `null` にはならないが、日時を表示する際は念のため防御的にハンドリングすることを推奨する。

```tsx
// 日時表示の例
<span>{room.lastMessageSnapshot?.createdAt?.toLocaleString() ?? ""}</span>
```

### writeBatch の使用

メッセージ送信時は必ず writeBatch でメッセージ作成 + `lastMessageSnapshot` 更新をアトミック実行する。
これにより、ルーム一覧で最新メッセージが常に正しく表示される。

### 楽観的UIのライフサイクル

```
sendText/sendFile
  ↓
pending 追加（status: "sending" or "uploading"）→ 即座にUI表示
  ↓
writeBatch 成功 → status: "sent"
  ↓
onSnapshot で実メッセージ到着 → ID 一致で pending 除去
  ↓
失敗時: status: "failed" → retry / dismiss で操作
```

メッセージ ID は送信前に事前生成（`generateMessageId`）し、pending と実メッセージの照合に使用する。

### 未読管理

- `isRoomUnread(room, uid)`: 未読判定。最新メッセージの送信者が自分なら未読としない
- `countUnreadRooms(rooms, uid)`: 未読ルーム数を取得
- `useUnreadCount(uid, options?)`: 未読ルーム数のリアルタイム取得フック（バッジ表示用）
- `readAt` は入室時・滞在中（新着メッセージ受信時）・退出時に `useReadAt` で更新
- メッセージ送信時は writeBatch で `readAt` もアトミック更新されるため、自分の送信で未読にならない

```tsx
// ヘッダーやボトムナビのバッジ表示
import { useUnreadCount } from "@/features/chatRoom/hooks/firestore/useUnreadCount";

const unreadCount = useUnreadCount(uid);
// <Badge count={unreadCount} />
```

### ファイルアップロード

- `clientUploader`（`src/lib/storage/client/`）を使用
- アップロード中は `status: "uploading"` + `uploadProgress` で進捗表示
- キャンセル（`cancelUpload`）で Storage からのクリーンアップも実行
- 失敗時の再送は再アップロードから実行

### 定数の変更

`constants/chat.ts` で以下を調整可能:

| 定数 | デフォルト値 | 説明 |
|---|---|---|
| `MESSAGE_MAX_LENGTH` | 5000 | テキストメッセージの最大文字数 |
| `MESSAGES_PER_PAGE` | 30 | 1回のページネーションで取得する件数 |
| `MAX_PARTICIPANTS` | 30 | グループルームの最大参加者数 |
| `IMAGE_MAX_SIZE` | 10MB | 画像ファイルの最大サイズ |
| `FILE_MAX_SIZE` | 20MB | 一般ファイルの最大サイズ |

### 将来の拡張に備えた構造

以下の機能は現在未実装だが、現在の構造を破壊せずに追加可能:

- **リプライ**: `ChatMessage` に `replyTo: { messageId, content, senderId }` を追加
- **メンション**: `ChatMessage` に `mentions: string[]` を追加
- **リアクション**: サブコレクション `messages/{messageId}/reactions` を新設
- **タイピング表示**: 別コレクション or Realtime Database を使用
- **既読レシート**: 既存の `readAt` マップを活用

いずれも既存フィールドへの変更は不要で、新フィールド・新コレクションの追加のみで対応できる。
