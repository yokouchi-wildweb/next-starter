# chatRoom/hooks/firestore

## Overview

- Firestore リアルタイム用のフック。入口の index は無く、ファイルの path で読む(`@/domains/chatRoom/hooks/firestore/<name>`)
- 統合 Hook(`useChatScreen` / `useUnreadCount` / `useBulkMessageSender`)で通常は足りる。個別 Hook は細かい制御が要る場合に使う
- 使い方の例: `../../README.md` Usage

## API

### 統合 Hook

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
| `sendFile` | `(file: File, type: "image" \| "video" \| "file") => ValidationResult` | ファイル/画像/動画送信 |
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

#### `useBulkMessageSender(senderId)`

複数ユーザーに同一のダイレクトメッセージを一斉送信する。

| パラメータ | 型 | 説明 |
|---|---|---|
| `senderId` | `string` | 送信者の userId |

| 戻り値 | 型 | 説明 |
|---|---|---|
| `send` | `(params: BulkSendParams) => Promise<BulkSendResult>` | 一斉送信を実行 |
| `status` | `"idle" \| "sending" \| "done"` | 送信状態 |
| `progress` | `BulkSendProgress \| null` | 進捗情報（`{ completed, total, latest }`） |
| `result` | `BulkSendResult \| null` | 最終結果（`{ results, successCount, failedCount }`） |
| `reset` | `() => void` | 状態をリセット |

```ts
type BulkSendParams = {
  targetUserIds: string[];
  content: string;
  metadata?: MessageMetadata;
  concurrency?: number; // デフォルト: 5
};
```

> 内部では同時実行数を制限して Firestore のレート制限に配慮する。各宛先の成功/失敗は独立しており、一部が失敗しても他の送信には影響しない。

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
| `sendFile` | `(file: File, type: "image" \| "video" \| "file") => ValidationResult` | ファイル/画像/動画送信 |
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
