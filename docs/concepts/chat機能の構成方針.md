# チャットドメイン構成方針 V2

## 概要

ユーザー間チャット機能の設計方針。1on1 およびグループチャットに対応。

- Firestore をデータストアとし、リアルタイム同期に対応
- chat_room を中心とした構造設計
- メッセージはサブコレクションで管理
- 一覧表示高速化のため last_message_snapshot（冗長保存）を導入
- 未読管理を chat_room 内に統合（追加読取なし）

---

## データ構造

### chat_rooms/{roomId}

| フィールド名              | 型                          | 説明                                              |
| ------------------------- | --------------------------- | ------------------------------------------------- |
| `id`                      | `string`（doc ID）          | ルーム識別子                                      |
| `type`                    | `"direct"` \| `"group"`     | チャット種別                                      |
| `participants`            | `string[]`                  | user_id の配列。一覧取得用（array-contains）。上限30人 |
| `participant_pair`        | `string \| null`            | directのみ。ソート済みUID結合キー（重複チェック用）|
| `name`                    | `string \| null`            | グループ名（groupのみ）                           |
| `read_at`                 | `{ [userId]: Timestamp }`   | 各ユーザーの最終閲覧時刻（未読管理）              |
| `last_message_snapshot`   | `object \| null`            | 最新メッセージの冗長保存（下記構造）              |
| `created_at`              | `Timestamp`                 | 作成日時                                          |
| `updated_at`              | `Timestamp`                 | ルームメタデータの最終更新日時（下記参照）        |

#### updated_at と last_message_snapshot.created_at の役割

| フィールド | 用途 |
|---|---|
| `last_message_snapshot.created_at` | 一覧画面のソート順（最新メッセージ順）に使用 |
| `updated_at` | ルーム自体の最終更新日時（管理・デバッグ用途） |

`updated_at` はメッセージ送信だけでなく、グループ名変更・参加者の追加削除などルームメタデータの変更時にも更新される。一覧のソートには `last_message_snapshot.created_at` を使用すること。

`last_message_snapshot` が null になるケースを防ぐため、ルーム作成時に writeBatch で type: "system" のメッセージ（「ルームが作成されました」等）を同時に書き込み、last_message_snapshot を初期化する。これにより一覧ソートのクエリが単一フィールドの orderBy で完結する。

#### last_message_snapshot の構造

```ts
{
  type: "text" | "image" | "file" | "system";
  content: string;
  sender_id: string;
  created_at: Timestamp;
}
```

#### participant_pair の生成ルール

directルーム作成時に `[uid1, uid2].sort().join("_")` で正規化したキーを保存する。これにより `where("participant_pair", "==", key)` で既存ルームの重複チェックが1クエリで完結する。groupルームでは `null`。

---

### chat_rooms/{roomId}/messages/{messageId}

| フィールド名 | 型                                         | 説明                                    |
| ------------ | ------------------------------------------ | --------------------------------------- |
| `id`         | `string`（doc ID）                         | メッセージ ID                           |
| `type`       | `"text"` \| `"image"` \| `"file"` \| `"system"` | メッセージ種別                    |
| `content`    | `string`                                   | 本文（image/fileの場合はURL）           |
| `sender_id`  | `string`                                   | 送信者の user_id                        |
| `metadata`   | `object \| null`                           | image/file時の付加情報（下記構造）      |
| `created_at` | `Timestamp`                                | 作成日時                                |

#### metadata の構造（optional）

```ts
{
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  thumbnail_url?: string;
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

- chat_room の `read_at` フィールドで管理。ユーザーごとの最終閲覧時刻を記録する
- 未読判定: `room.last_message_snapshot?.created_at > room.read_at?.[myUid]`
- 更新タイミング: チャット画面を開いた時のみ。一覧画面のリアルタイムリスナーでは更新しない（読取コスト抑制）
- chat_room 内に統合することで、一覧取得時に追加読取なしで未読判定が完結する

### スケーラビリティ制約

グループチャットの最大参加者数: **30人**

read_at を chat_room ドキュメント内の map で管理しているため、参加者が多いと同時書き込み競合のリスクがある。ただし read_at の更新は「ユーザーがチャット画面を開いた瞬間」のみであり、30人規模では実害がない。

100人超のグループが必要になった場合は、`chat_rooms/{roomId}/members/{userId}` サブコレクションへの分離を検討する。一覧での未読判定が追加読取になるトレードオフはあるが、書き込み競合を回避できる。

---

## last_message_snapshot の更新方式

writeBatch（クライアント側バッチ書き込み）を採用する。

- メッセージ作成と chat_room の last_message_snapshot 更新をアトミックに実行
- Cloud Functions トリガーと比較して遅延がなく、送信直後に一覧へ反映される
- セキュリティルールで整合性を強制可能

```ts
const batch = writeBatch(db);
const messageRef = doc(collection(db, `chat_rooms/${roomId}/messages`));
const roomRef = doc(db, `chat_rooms/${roomId}`);

batch.set(messageRef, {
  type: "text",
  content,
  sender_id: myUid,
  created_at: serverTimestamp(),
});

batch.update(roomRef, {
  last_message_snapshot: {
    type: "text",
    content,
    sender_id: myUid,
    created_at: serverTimestamp(),
  },
  updated_at: serverTimestamp(),
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
- `created_at` 降順、`startAfter` で最古メッセージの `created_at` を渡す
- 上スクロールで過去メッセージを追加読み込み（逆無限スクロール）

2つのクエリを併用する:

1. **初回 + 過去取得**: `orderBy("created_at", "desc").limit(30).startAfter(oldestCreatedAt)`
2. **新着リアルタイム受信**: `orderBy("created_at", "asc").startAfter(latestCreatedAt)` で `onSnapshot`

---

## セキュリティルール方針

Firestore セキュリティルールはドキュメント単位で独立評価されるため、バッチ内の他ドキュメントへの書き込みを条件にすることはできない。フィールド値の整合性チェックで制約を担保する。

また、update は1つの allow 文で記述する必要があるため、read_at のみの更新か last_message_snapshot のみの更新かを条件分岐で判定する。

```
chat_rooms:
  read:   request.auth.uid in resource.data.participants
  create: request.auth.uid in request.resource.data.participants
  update: if
    (isReadAtOnlyUpdate() && readAtRules()) ||
    (isSnapshotOnlyUpdate() && snapshotRules())

    isReadAtOnlyUpdate():
      - read_at のみ変更されている（participants, last_message_snapshot 等は未変更）
    readAtRules():
      - 自分の read_at フィールドのみ更新可能

    isSnapshotOnlyUpdate():
      - last_message_snapshot と updated_at のみ変更されている（participants 等は未変更）
    snapshotRules():
      - sender_id == request.auth.uid（自分が送信者の snapshot のみ書き込み可能）
      - content is string かつ content.size() <= 5000
      - type in ["text", "image", "file", "system"]

chat_rooms/{roomId}/messages:
  read:   親ルームの participants に含まれること
  create:
    - sender_id == request.auth.uid かつ親ルームの participants に含まれること
    - content is string かつ content.size() <= 5000
  update/delete: 不可（メッセージ編集・削除は初期スコープ外）
```

メッセージ本文の上限は 5000文字とする（messages の create と last_message_snapshot の両方に同じ制限を適用）。

---

## 運用ポリシー

- すべてのチャットは chat_room を単位として管理する（1on1 もグループも）
- メッセージ送信時は writeBatch で last_message_snapshot を同時更新する
- directルーム作成前に participant_pair で既存ルームの存在チェックを行う
- メッセージの type は初回から必ず設定する（後方互換ハンドリングを避けるため）

---

## 実装方針の決定事項

### ドメイン配置

- core ドメインとして `src/features/core/chat_room/` に配置
- chat_room は domain.json を作成し、サーバー側 CRUD・管理画面を自動生成する
- chat_message（サブコレクション）は domain.json では対応できないため手動実装

### 自動生成と手動実装の分担

| 対象 | 方式 | 理由 |
|---|---|---|
| chat_room サーバー CRUD | 自動生成（domain.json） | 管理画面からの監査・検索・論理削除に利用 |
| chat_room 管理画面 | 自動生成（domain.json） | チャット内容の監査、不正利用対策 |
| chat_room クライアントサービス | 手動実装 | リアルタイム購読・writeBatch 等、Firestore 固有のクライアント操作が必要 |
| chat_room Hooks | 手動実装 | リアルタイム購読・送信状態管理など、CRUD フックでは対応できない |
| chat_message 全般 | 手動実装 | サブコレクション（`chat_rooms/{roomId}/messages`）のため自動生成不可 |

### Firestore ベースライブラリ

クライアント側の Firestore 操作には `src/lib/firestore/client/` を使用する。

- `subscribeCollection` / `subscribeCollectionChanges` — リアルタイム購読
- `subscribeDoc` — 単一ドキュメント購読
- `queryDocs` — カーソルベースページネーション（`lastSnapshot` 対応）
- `executeBatch` — メッセージ送信 + snapshot 更新のアトミック実行
- `executeTransaction` — directルーム重複チェック

### フィールド命名規則

- Firestore ドキュメントのフィールド名は **snake_case** を採用（プロジェクト全体の規則に準拠）
- コレクション名も snake_case（`chat_rooms`, `messages`）
- TypeScript の型定義では camelCase に変換（`participant_pair` → `participantPair`）

### 実装フェーズ

1. **Phase 1**: エンティティ定義（domain.json + 自動生成 + 手動の chat_message 型定義）
2. **Phase 2**: ClientService（ルーム操作）
3. **Phase 3**: ClientService（メッセージ操作）
4. **Phase 4**: Hooks
5. **Phase 5**: Store（送信状態管理）

---

## 将来的な拡張候補（未実装）

| フィールド名           | 用途                           |
| ---------------------- | ------------------------------ |
| `created_by`           | グループ作成者の ID            |
| `avatar_url` / `icon`  | グループ用アイコン画像         |
| `is_archived`          | アーカイブ状態フラグ           |
| `last_message_id`      | snapshot 併用型への移行        |

### メッセージ削除・編集の方針（実装時に準拠）

**削除: 論理削除方式を採用する**

- メッセージに `deleted_at: Timestamp | null` フィールドを追加し、削除時に設定する
- 表示側で `deleted_at` があれば「メッセージが削除されました」と表示する
- last_message_snapshot は変更しない。最新メッセージが削除された場合の一覧表示は、snapshot 内の情報と合わせて表示側で判定する（必要に応じて `last_message_snapshot` に `is_deleted` フラグを追加）
- メッセージの実データは保持されるため、管理画面での確認や不正利用対策に対応可能

**編集: 最新メッセージの場合のみ snapshot を同時更新する**

- 編集対象が最新メッセージかどうかを `last_message_snapshot.created_at` と比較して判定
- 最新メッセージであれば writeBatch でメッセージ更新と snapshot 更新をアトミックに実行
- 最新メッセージでなければメッセージのみ更新
- 編集履歴が必要な場合は `edited_at: Timestamp | null` フィールドで編集済み表示に対応
- 最新メッセージの判定はクライアント側で行う。編集操作中に別のメッセージが送信されて最新でなくなった場合は snapshot 更新をスキップするだけで実害はない

### Typing Indicator（入力中表示）の方針（実装時に準拠）

実装時は Firebase Realtime Database（RTDB）を使用する。Firestore は書き込み回数ベースの課金のため、数秒おきに発生する typing 状態の更新には不向き。RTDB は接続ベース課金で高頻度な小さい値の更新に最適化されている。

- RTDB 構造: `chat_typing/{roomId}/{userId}: { is_typing: boolean, updated_at: number }`
- RTDB の `onDisconnect` でブラウザ切断時に自動クリア
- クライアント側で `updated_at` が5秒以上前なら表示しないフェイルセーフを入れる
- RTDB の導入は typing indicator が必要になったタイミングで行う（初期スコープでは導入不要）

### 既読表示（Read Receipt）の方針（実装時に準拠）

- 1on1: 「既読」を表示。相手の `read_at` と自分のメッセージの `created_at` を比較して既読判定
- グループ: 既読数のみ表示（例:「既読 3」）。誰が読んだかは表示しない。`read_at` のうち該当メッセージの `created_at` より後のユーザー数をカウント
- いずれも現在の `read_at` 構造で追加のデータ設計なしに対応可能
