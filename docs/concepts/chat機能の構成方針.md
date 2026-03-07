# チャットドメイン構成方針 V2

## 概要

ユーザー間チャット機能の設計方針。1on1 およびグループチャットに対応。

- Firestore をデータストアとし、リアルタイム同期に対応
- chatRoom を中心とした構造設計
- メッセージはサブコレクションで管理
- 一覧表示高速化のため lastMessageSnapshot（冗長保存）を導入
- 未読管理を chatRoom 内に統合（追加読取なし）

---

## データ構造

### chatRooms/{roomId}

| フィールド名          | 型                          | 説明                                              |
| --------------------- | --------------------------- | ------------------------------------------------- |
| `id`                  | `string`（doc ID）          | ルーム識別子                                      |
| `type`                | `"direct"` \| `"group"`     | チャット種別                                      |
| `participants`        | `string[]`                  | userId の配列。一覧取得用（array-contains）。上限30人 |
| `participantPair`     | `string \| null`            | directのみ。ソート済みUID結合キー（重複チェック用）|
| `name`                | `string \| null`            | グループ名（groupのみ）                           |
| `readAt`              | `{ [userId]: Timestamp }`   | 各ユーザーの最終閲覧時刻（未読管理）              |
| `lastMessageSnapshot` | `object \| null`            | 最新メッセージの冗長保存（下記構造）              |
| `createdAt`           | `Timestamp`                 | 作成日時                                          |
| `updatedAt`           | `Timestamp`                 | ルームメタデータの最終更新日時（下記参照）        |

#### updatedAt と lastMessageSnapshot.createdAt の役割

| フィールド | 用途 |
|---|---|
| `lastMessageSnapshot.createdAt` | 一覧画面のソート順（最新メッセージ順）に使用 |
| `updatedAt` | ルーム自体の最終更新日時（管理・デバッグ用途） |

`updatedAt` はメッセージ送信だけでなく、グループ名変更・参加者の追加削除などルームメタデータの変更時にも更新される。一覧のソートには `lastMessageSnapshot.createdAt` を使用すること。

`lastMessageSnapshot` が null になるケースを防ぐため、ルーム作成時に writeBatch で type: "system" のメッセージ（「ルームが作成されました」等）を同時に書き込み、lastMessageSnapshot を初期化する。これにより一覧ソートのクエリが単一フィールドの orderBy で完結する。

#### lastMessageSnapshot の構造

```ts
{
  type: "text" | "image" | "file" | "system";
  content: string;
  senderId: string;
  createdAt: Timestamp;
}
```

#### participantPair の生成ルール

directルーム作成時に `[uid1, uid2].sort().join("_")` で正規化したキーを保存する。これにより `where("participantPair", "==", key)` で既存ルームの重複チェックが1クエリで完結する。groupルームでは `null`。

---

### chatRooms/{roomId}/messages/{messageId}

| フィールド名 | 型                                         | 説明                                    |
| ------------ | ------------------------------------------ | --------------------------------------- |
| `id`         | `string`（doc ID）                         | メッセージ ID                           |
| `type`       | `"text"` \| `"image"` \| `"file"` \| `"system"` | メッセージ種別                    |
| `content`    | `string`                                   | 本文（image/fileの場合はURL）           |
| `senderId`   | `string`                                   | 送信者の userId                         |
| `metadata`   | `object \| null`                           | image/file時の付加情報（下記構造）      |
| `createdAt`  | `Timestamp`                                | 作成日時                                |

#### metadata の構造（optional）

```ts
{
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}
```

---

## ファイル送信方針

### 基本方針

テキスト送信とファイル送信は完全に分離する。1つのメッセージに対して type は排他的に1種類とし、ファイルにテキストを付加することはできない（LINE と同様）。これにより content の中身が type で一意に決まり、実装・UIがシンプルになる。

### アップロードフロー

1. ファイル選択 → Firebase Storage にアップロード（進捗表示）
2. アップロード完了 → ダウンロードURL取得
3. writeBatch でメッセージ（`content: URL`, `type: "image"/"file"`）+ snapshot 更新

### ストレージパス

```
chat/{roomId}/{messageId}/{fileName}
```

### 制限事項

| 項目 | 値 |
|---|---|
| 1ファイルの上限サイズ | 10MB（画像）/ 20MB（その他） |
| 対応形式（画像） | jpg, png, gif, webp |
| 対応形式（ファイル） | pdf, docx, xlsx 等 |
| 画像リサイズ | アップロード時にクライアント側で最大幅1920pxにリサイズ |

### Storage セキュリティルール

```
chat/{roomId}/{messageId}/{fileName}:
  read:  認証済みユーザー（participants チェックは実装時に要検討）
  write: 認証済みユーザー かつ ファイルサイズ上限チェック
```

※ Storage ルールから Firestore の participants を直接参照するのは困難なため、Custom Claims または APIルート経由のアップロードを実装時に検討する。

---

## 未読管理

- chatRoom の `readAt` フィールドで管理。ユーザーごとの最終閲覧時刻を記録する
- 未読判定: `room.lastMessageSnapshot?.createdAt > room.readAt?.[myUid]`
- 更新タイミング: チャット画面を開いた時のみ。一覧画面のリアルタイムリスナーでは更新しない（読取コスト抑制）
- chatRoom 内に統合することで、一覧取得時に追加読取なしで未読判定が完結する

### スケーラビリティ制約

グループチャットの最大参加者数: **30人**

readAt を chatRoom ドキュメント内の map で管理しているため、参加者が多いと同時書き込み競合のリスクがある。ただし readAt の更新は「ユーザーがチャット画面を開いた瞬間」のみであり、30人規模では実害がない。

100人超のグループが必要になった場合は、`chatRooms/{roomId}/members/{userId}` サブコレクションへの分離を検討する。一覧での未読判定が追加読取になるトレードオフはあるが、書き込み競合を回避できる。

---

## lastMessageSnapshot の更新方式

writeBatch（クライアント側バッチ書き込み）を採用する。

- メッセージ作成と chatRoom の lastMessageSnapshot 更新をアトミックに実行
- Cloud Functions トリガーと比較して遅延がなく、送信直後に一覧へ反映される
- セキュリティルールで整合性を強制可能

```ts
const batch = writeBatch(db);
const messageRef = doc(collection(db, `chatRooms/${roomId}/messages`));
const roomRef = doc(db, `chatRooms/${roomId}`);

batch.set(messageRef, {
  type: "text",
  content,
  senderId: myUid,
  createdAt: serverTimestamp(),
});

batch.update(roomRef, {
  lastMessageSnapshot: {
    type: "text",
    content,
    senderId: myUid,
    createdAt: serverTimestamp(),
  },
  updatedAt: serverTimestamp(),
});

await batch.commit();
```

---

## オフライン / エラーハンドリング方針

### オフラインキャッシュ

Firestore Web SDK のオフラインキャッシュを有効化する（デフォルト動作）。オフライン時も `onSnapshot` でローカルキャッシュからデータを返し、`writeBatch` はローカルに書き込まれてオンライン復帰時に自動同期される。特別な実装は不要。

### 送信時の status 管理

メッセージの送信状態をローカルステート（zustand等）で管理する。Firestore には保存しない。

UXフロー:

1. 送信ボタン押下 → `status: "sending"` で即座に表示（楽観的UI）
2. writeBatch 成功（Promise resolve） → `status: "sent"` に更新
3. writeBatch 失敗（Promise reject） → `status: "failed"` に更新、再送ボタン表示
4. 再送ボタン押下 → 同じ writeBatch を再実行

オフライン時とオンラインエラーの挙動の違い:

- **オフライン時**: writeBatch の Promise は reject されず pending のまま。ローカルキャッシュに書き込まれ、オンライン復帰時に自動同期される。UIは `status: "sending"` が継続する（「失敗」にはならない）
- **オンラインでの失敗**（セキュリティルール違反、ネットワークエラー等）: Promise が reject され `status: "failed"` になる。この場合のみ再送ボタンを表示する

自動リトライはしない。メッセージの重複送信リスクがあり、送信失敗をユーザーに明示する方がUXとして自然（LINE、Slack等と同様）。

---

## ページネーション方針

カーソルベース（startAfter）を採用する。offset ベースはスキップ分も読取カウントされるため非効率。

- 1回あたり 20〜30件取得（limit）
- `createdAt` 降順、`startAfter` で最古メッセージの `createdAt` を渡す
- 上スクロールで過去メッセージを追加読み込み（逆無限スクロール）

2つのクエリを併用する:

1. **初回 + 過去取得**: `orderBy("createdAt", "desc").limit(30).startAfter(oldestCreatedAt)`
2. **新着リアルタイム受信**: `orderBy("createdAt", "asc").startAfter(latestCreatedAt)` で `onSnapshot`

---

## セキュリティルール方針

Firestore セキュリティルールはドキュメント単位で独立評価されるため、バッチ内の他ドキュメントへの書き込みを条件にすることはできない。フィールド値の整合性チェックで制約を担保する。

また、update は1つの allow 文で記述する必要があるため、readAt のみの更新か lastMessageSnapshot のみの更新かを条件分岐で判定する。

```
chatRooms:
  read:   request.auth.uid in resource.data.participants
  create: request.auth.uid in request.resource.data.participants
  update: if
    (isReadAtOnlyUpdate() && readAtRules()) ||
    (isSnapshotOnlyUpdate() && snapshotRules())

    isReadAtOnlyUpdate():
      - readAt のみ変更されている（participants, lastMessageSnapshot 等は未変更）
    readAtRules():
      - 自分の readAt フィールドのみ更新可能

    isSnapshotOnlyUpdate():
      - lastMessageSnapshot と updatedAt のみ変更されている（participants 等は未変更）
    snapshotRules():
      - senderId == request.auth.uid（自分が送信者の snapshot のみ書き込み可能）
      - content is string かつ content.size() <= 5000
      - type in ["text", "image", "file", "system"]

chatRooms/{roomId}/messages:
  read:   親ルームの participants に含まれること
  create:
    - senderId == request.auth.uid かつ親ルームの participants に含まれること
    - content is string かつ content.size() <= 5000
  update/delete: 不可（メッセージ編集・削除は初期スコープ外）
```

メッセージ本文の上限は 5000文字とする（messages の create と lastMessageSnapshot の両方に同じ制限を適用）。

---

## 運用ポリシー

- すべてのチャットは chatRoom を単位として管理する（1on1 もグループも）
- メッセージ送信時は writeBatch で lastMessageSnapshot を同時更新する
- directルーム作成前に participantPair で既存ルームの存在チェックを行う
- メッセージの type は初回から必ず設定する（後方互換ハンドリングを避けるため）

---

## 将来的な拡張候補（未実装）

| フィールド名         | 用途                           |
| -------------------- | ------------------------------ |
| `createdBy`          | グループ作成者の ID            |
| `avatarUrl` / `icon` | グループ用アイコン画像         |
| `isArchived`         | アーカイブ状態フラグ           |
| `lastMessageId`      | snapshot 併用型への移行        |

### メッセージ削除・編集の方針（実装時に準拠）

**削除: 論理削除方式を採用する**

- メッセージに `deletedAt: Timestamp | null` フィールドを追加し、削除時に設定する
- 表示側で `deletedAt` があれば「メッセージが削除されました」と表示する
- lastMessageSnapshot は変更しない。最新メッセージが削除された場合の一覧表示は、snapshot 内の情報と合わせて表示側で判定する（必要に応じて `lastMessageSnapshot` に `isDeleted` フラグを追加）
- メッセージの実データは保持されるため、管理画面での確認や不正利用対策に対応可能

**編集: 最新メッセージの場合のみ snapshot を同時更新する**

- 編集対象が最新メッセージかどうかを `lastMessageSnapshot.createdAt` と比較して判定
- 最新メッセージであれば writeBatch でメッセージ更新と snapshot 更新をアトミックに実行
- 最新メッセージでなければメッセージのみ更新
- 編集履歴が必要な場合は `editedAt: Timestamp | null` フィールドで編集済み表示に対応
- 最新メッセージの判定はクライアント側で行う。編集操作中に別のメッセージが送信されて最新でなくなった場合は snapshot 更新をスキップするだけで実害はない

### Typing Indicator（入力中表示）の方針（実装時に準拠）

実装時は Firebase Realtime Database（RTDB）を使用する。Firestore は書き込み回数ベースの課金のため、数秒おきに発生する typing 状態の更新には不向き。RTDB は接続ベース課金で高頻度な小さい値の更新に最適化されている。

- RTDB 構造: `chatTyping/{roomId}/{userId}: { isTyping: boolean, updatedAt: number }`
- RTDB の `onDisconnect` でブラウザ切断時に自動クリア
- クライアント側で `updatedAt` が5秒以上前なら表示しないフェイルセーフを入れる
- RTDB の導入は typing indicator が必要になったタイミングで行う（初期スコープでは導入不要）

### 既読表示（Read Receipt）の方針（実装時に準拠）

- 1on1: 「既読」を表示。相手の `readAt` と自分のメッセージの `createdAt` を比較して既読判定
- グループ: 既読数のみ表示（例:「既読 3」）。誰が読んだかは表示しない。`readAt` のうち該当メッセージの `createdAt` より後のユーザー数をカウント
- いずれも現在の `readAt` 構造で追加のデータ設計なしに対応可能
