# servers/room — ルーム権威サーバー

Cloudflare Durable Objects 上で動く「1 ルーム = 1 直列化権威 + WebSocket 配信」の汎用基盤。
Next.js アプリの**外側**にデプロイされる独立プログラムであり、`servers/` 区画の最初の住人。

**オプトイン (既定: 無効)**。使わないフォークには依存インストール・課金・ランタイム影響が一切無い。

---

## いつ使うか (Firestore 配信との棲み分け)

| 条件 | 使うもの |
|------|---------|
| 共有ドキュメントへの書き込みが**毎秒級で持続** (レイドHP、共有ゲージ、参加者カウンタ) | **この基盤** |
| 購読ファンアウトが**数百接続超** (書き込み × 購読者数の課金が成立しない) | **この基盤** |
| 閾値検知に**単一トランザクション意味論**が必要 (ゲージ満タン → 1回だけ発動) | **この基盤** |
| 上記に該当しない通常のリアルタイム UX (チャット、通知、per-user ドキュメント) | Firestore 配信 (chatRoom 方式) |

背景と判断基準の原本: `docs/!must-read/バックエンド構成ドクトリン.md`

## 何が保証されるか

- **直列化**: 1 ルームのアクションは必ず 1 インスタンスで順番に処理される (Durable Objects の性質)。
  「ゲージ >= max でブレイク発動を正確に 1 回」のような閾値ロジックが sharding なしで書ける
- **状態同期**: 購読者は接続直後 + 毎変更時に最新状態を受け取る。切断→再接続でも自動で追いつく
- **永続性**: 状態は Durable Object storage に毎変更で保存され、hibernation / eviction を跨いで生きる
- **権威の分離**: 経済 (抽選・ウォレット・アイテム) は従来通り PG が権威。ルームは表示・調整状態のみを持つ

## アーキテクチャ

```
ブラウザ (N人)
  │ WebSocket (room_client トークン、状態が即時 push される)
  ▼
Cloudflare Worker (servers/room)
  └─ RoomDurableObject (ns/roomId ごとに1個)
       ・reducer (純粋関数) で状態遷移 ─── 実装は src/features/<domain>/room/
       ・effects: event (一過性配信) / callback (アプリAPIへ署名付きPOST) / schedule (DO alarm で指定時刻に自己dispatch)
  ▲                                    │
  │ HTTP dispatch/getState             │ callback (room_callback トークン)
  │ (room_server トークン)             ▼
Next.js アプリ (Vercel) ── ServerService → createRoomClient / verifyRoomCallback
```

- 共有プロトコル (型・バージョン・トークン語彙) は `src/lib/realtimeRoom/protocol/` が唯一の接点
- トークンは全て専用鍵 `REALTIME_ROOM_AUTH_SECRET` (HS256) で署名 (認証セッション鍵とは分離)
- プロトコルバージョン不一致はハンドシェイク/HTTP 応答で明示エラー (スキュー検知)

## 認可モデル (fail-closed)

| 経路 | トークン | 制約 |
|------|---------|------|
| WebSocket 購読 | `room_client` (短命、`GET /api/realtime-room/token` が発行、要ログイン) | 対象 ns/roomId のみ |
| WebSocket 直接 dispatch | 同上 | `RoomDefinition.clientActions` 許可リストの action のみ (既定: 全拒否) |
| HTTP dispatch/getState | `room_server` (短命、Next サーバーが署名) | サーバーのみが持てる |
| callback (Worker→アプリ) | `room_callback` (短命、Worker が署名) | `verifyRoomCallback` で検証必須 |

**権威性の必要なアクション (経済・当選・確定処理) は clientActions に載せず、必ず
Next サーバー経由 (`createRoomClient`) にすること。** クライアント直接 dispatch は
「参加タップ」「エモート」のような高頻度・低権威アクション専用。

## 新しいルーム (namespace) の追加手順

1. **ルームロジックを書く**: `src/features/<domain>/room/definition.ts` に `RoomDefinition` を実装
   - reducer は純粋関数 (I/O・乱数・現在時刻の直接参照禁止。時刻は action payload で渡す)
   - import 制約は ESLint `realtime-room/purity` が強制 (相対 / protocol / import type のみ)
2. **登録する**: `servers/room/src/registry.ts` (下流編集点) に namespace 名で登録
3. **デプロイ**: `pnpm room:deploy` (または git push で CI)
4. サーバーから使う: ServerService で `createRoomClient<S, A>("<namespace>")`
5. クライアントから使う: `useRoomState<S, A>("<namespace>", roomId)`

SDK の使用例: `src/lib/realtimeRoom/README.md`

## セットアップ (downstream 有効化手順)

```bash
pnpm room:init   # wrangler.toml 生成 + 依存インストール + チェックリスト表示
```

以降は init が表示するチェックリスト通り:

1. Cloudflare アカウント登録 (無料で開始可。本番規模の WebSocket 接続数は Workers Paid ~$5/月)
2. **Worker 名の確認**: room:init は `room-server-<package名>` を wrangler.toml に書き込む。
   既定名 `room-server` のままのデプロイは room:deploy が拒否する (同一アカウント同居時、
   wrangler deploy は同名 Worker を**無言で置換**するため。過去に他プロジェクトの検証 Worker を
   上書きしかけた実事例あり)
3. **workers.dev サブドメインを先に登録する** (ダッシュボード → Workers & Pages → 右カラム。アカウントごとに1回だけ)。
   この時点で Worker URL は `https://<Worker名>.<サブドメイン>.workers.dev` と機械的に確定する。
   初回デプロイの対話プロンプトに任せないこと (CI では対話できず失敗する / env を先に揃えられる)
4. Next 側 env に `REALTIME_ROOM_URL` を登録 (公開情報なので通常の env でよい)
5. `src/config/app/realtime-room.config.ts` の `enabled: true`
6. デプロイ (下記)
7. **共有鍵の生成と登録 (必ず初回デプロイの後に)**: `pnpm room:secret`
   — 鍵生成 → `wrangler secret bulk` で Worker へ非対話登録 → Next 側 env に貼る
   `REALTIME_ROOM_AUTH_SECRET` 行を表示 (Vercel では Sensitive 指定を推奨)。
   未デプロイ Worker へは明示拒否する (対話プロンプトの罠のツール化)。登録済み鍵の誤上書きも拒否
   (意図的なローテーションは `pnpm room:secret --rotate`)。secret は以後のデプロイでも保持される
8. 動作確認: `pnpm room:check` — 疎通・認可 fail-closed・WS 配信・永続化の 11 項目を機械検証
   (初回は workers.dev の伝播待ちで最大 60 秒リトライする。最低限なら `curl https://<Worker URL>/version`)

補足:
- 1つの Cloudflare アカウントに複数プロジェクトを同居させる場合、サブドメインは共通なので
  wrangler.toml の `name` をプロジェクト固有名 (例: `room-server-myapp`) に変えて URL を分岐させる
  (原則は 1 プロジェクト = 1 アカウントを推奨: 課金・権限・事故の分離)
- 本番で独自ドメインを使う場合は Worker に Custom Domain を割り当て、`REALTIME_ROOM_URL` を差し替えるだけでよい
- **dev から本番 Worker を共有しない**: ルーム状態は ns/roomId 単位で共有されるため、dev と本番が
  同じ Worker を向くと、同じ roomId への dev の dispatch が本番ユーザーの見ている状態を書き換え得る。
  原則: dev は `pnpm room:dev` (localhost:8787)。本番 Worker の共有は roomId が衝突しない検証に限る

**有効/無効の判定は config enabled + env の 1 点に集約されている。** 揃っていなければ
useRoomState は `status:"disabled"`、API は 503、deploy は skip — どのフォークで何を実行しても安全 (冪等)。

## デプロイ運用

| 経路 | コマンド | 用途 |
|------|---------|------|
| **統合 (手動運用の標準)** | `pnpm deploy:all` | **アプリ (Vercel) + Worker を 1 コマンドで揃えてデプロイ** (Worker → アプリの順)。room 無効フォークでは Worker を skip してアプリのみ — どのフォークでも常にこの 1 コマンドでよい。引数は vercel CLI へ透過 (無指定なら `--prod`)。要 vercel CLI + `wrangler login` or `CLOUDFLARE_API_TOKEN` |
| Worker 単体 | `pnpm room:deploy` | Worker だけ直した時の単体デプロイ。enabled=false なら skip |
| CI (オプション) | `git push` 連動 | git 連携デプロイのフォーク向け。`.github/workflows/deploy-room.yml.example` をコピーし GitHub Secrets 登録。Secrets 未登録なら skip でグリーン |
| ローカル開発 | `pnpm room:dev` | **Cloudflare アカウント不要**。wrangler dev で DO 込みのローカル実行。Next 側は `REALTIME_ROOM_URL=http://localhost:8787` を指す |

Worker 側の変更が無い回でも deploy は無害 (冪等)。「今回 servers/room を触ったか」を人間が判断する必要はない。

`CLOUDFLARE_API_TOKEN` の作成: Cloudflare ダッシュボード → My Profile → API Tokens →
テンプレート **「Edit Cloudflare Workers」** で作成し、対象を自アカウントに限定する。
デプロイ権限を持つトークンなので、登録先 (GitHub Secrets / CI env) 以外への放置・共有はしないこと。

## 所有権と統治

- `src/core/` + `src/index.ts`: **上流所有 (CORE_FILES)**。変更は上流への提案経由
- `src/registry.ts` + `wrangler.toml`: **下流編集点**
- **wrangler.toml は有効化したフォークがコミットする** (vercel.json と同じ方式。secret は含まれず、
  Worker 名や vars のみなのでコミットして安全)。アップストリームは `.example` のみを出荷する
- ルームロジック本体: `src/features/<domain>/room/` (ドメインに帰属、純度制約付き)
- 境界: `servers/room → src` の import は `lib/realtimeRoom/protocol` と `features/*/room` のみ。
  `src → servers` の import は全面禁止
- プロトコル互換性を壊す変更は `ROOM_PROTOCOL_VERSION` をインクリメントすること

### 中間層フォークが有効化する場合 (自分がさらに下流フォーク群の上流であるとき)

有効化コミット (`enabled: true` + wrangler.toml) は**下流フォークにもそのまま伝播する**。下流側では:

- wrangler.toml ごと引いたフォークは、**中間層の Worker 名のまま自アカウントへデプロイ**してしまう
  (room:deploy の既定名ガードは固有名に変更済みの名前を検知できない)
- `enabled: true` だけ引いて wrangler.toml が無いフォークは、`deploy:all` が明示エラーで止まる
  (fail-closed としては正しいが、下流にとっては突然の変化)

対処: 中間層で有効化をコミットしたら、**ロールアウト時に下流へ DOWNSTREAM NOTICE (/downreq) を出す**こと。
内容は「wrangler.toml の name を自プロジェクト固有名へ変更 + 自アカウントでセットアップ (room:init 手順) or
使わないなら `enabled: false` へ戻す」の二択を明示する。

## 高頻度ルーム向けオプション

- **状態pushの合流** (`RoomDefinition.broadcastThrottleMs`): 既定 0 = dispatch 毎に全購読者へ即時 push。
  高頻度ルーム (毎秒数十 dispatch × 大人数購読) では「N ms に最大1回」に間引ける (目安 100〜250)。
  leading + trailing edge で最終状態は必ず配信され、状態はスナップショットなので間引きは無損失。
  接続時の初期 push・event effect・dispatch HTTP レスポンスは常に即時 (対象外)
- **時限アクション** (`{ type: "schedule", atMs, action }` effect): DO alarm で指定時刻に action を
  自己 dispatch (通常の直列化・配信・effects 経路、actorType:"server")。バフ失効・カウントダウン等の
  時間駆動遷移用。ルームにつき単一スロット (後の予約が置換、`action: null` でクリア)、
  予約は storage 永続で eviction を跨いで発火する。at-most-once 相当のため、厳密な失効判定は
  reducer 側の遅延評価 (payload の nowMs 比較) を安全網として併用すること。
  atMs は純度維持のため action payload から計算する (reducer 内で Date.now() 禁止は従来通り)
- 両方の実装例: `src/registry.ts` の sample-counter (broadcastThrottleMs + scheduleReset)

## 制約・非対象

- ルーム状態は「小さな JSON」(HP・ゲージ・カウンタ等) を想定。大きなリストや履歴はここに持たない
  (ライブフィードは event effect で流し、永続化は callback → PG へ)
- callback effect は fire-and-forget (失敗はログのみ)。**最終的な永続化の責任はアプリ側の設計に置く**
  (例: 抽選結果は先に PG に書き、ルームには表示反映だけを dispatch する)
- Firestore の全面置き換えではない。非競合の per-user ドキュメント購読は従来通り Firestore
