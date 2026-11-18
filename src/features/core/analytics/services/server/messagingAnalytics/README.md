# analytics/messagingAnalytics

## Overview

- 連絡の一次の記録（回・配達・お知らせの既読・配信停止）は messaging にあり、集計はここで読むだけ（analytics → messaging の一方向。messaging は analytics を読まない）。画面は作らない（fork が組む）。
- 住所: 規則 `messagingAnalytics`（`dependsOn: ["analytics"]`、既定 開 = analytics が開なら開。paymentAnalytics / walletAnalytics と同じ形）。route は管理者だけ

## Usage

- クライアント / フック（画面は置かない。fork の画面がそのまま使う）: `services/client/messagingAnalyticsClient.ts`（fetchMessagingSummary / fetchMessagingSeries / fetchMessagingBreakdown(axis, params) / fetchMessagingDispatches）+ 1 本 1 ファイルのフック（入口の index は無い。ファイルの path で読む）
  - `hooks/useMessagingAnalyticsSummary.ts` / `useMessagingAnalyticsSeries.ts`: SWR（`(params, { enabled?, config? })`、鍵 = 期間と絞りの値）
  - `hooks/useMessagingAnalyticsBreakdown.ts`: SWR（`(axis, params, options)`、axis が null なら取らない）
  - `hooks/useMessagingAnalyticsDispatches.ts`: 回ごとは増え続ける一覧なので `useInfiniteScrollQuery` のカーソルのモード（`{ params, limit?（既定 20）, enabled? }`、期間・絞りが変われば先頭から。`InfiniteScrollList` に渡す）。結果の横に直近の応答の `dispatchesEnabled` / `trackingEnabled`（まだ無ければ null）

## API

- 関数が測る物の開閉を自分で確かめる: 開封・クリックは計測 `messagingTracking` が閉なら `null`（0 と区別、`trackingEnabled: false`）、回ごとのビューは回の管理 `messagingDispatches` が閉なら空（`dispatchesEnabled: false`）
- 絞り（共通）: `channel` / `messageKey` / `category`（期間は共通クエリパラメータ）

### 指標（`MessagingCounts`）と出どころ

- `targeted` / `sent` / `failed` / `skippedNoAddress` / `suppressed`（止めで飛ばした）/ `skippedThrottled`: 回の `channel_counts`（全員・ロール宛ての行の無い数と共有のお知らせも入る）
- `delivered` / `bounced` / `complained` / `opened` / `clicked`: 配達の行
- `read`: お知らせの既読（受信者ごとの行 = 既読の行か全部既読の watermark、共有の行 = 見られる利用者のうち既読の人）。`inAppSent` = その分母
- `unsubscribed`: 配信停止の行（`message_preferences` の行 + `message_suppressions` の one_click の行）。種別まるごとの停止の行（`kind` あり）も数え、種類の軸の値は `'*'`。会員登録で宣伝に同意しなかった行（source `signup`、messaging `PREFERENCE_SIGNUP_SOURCE`）は配信停止ではないので数えない
- 率（`rates`）は同じ送りの組: ÷ `sent` = delivered / bounce / complaint / open / click / unsubscribe、÷ `targeted` = failed / suppressed、÷ `inAppSent` = read。分母 0・分子 null は null

### 送りの組

- 基準の時刻 = 回を送った時刻 `COALESCE(scheduled_at, created_at)`。到達・開封・既読も送った日に数える（同じ組の率）。配信停止だけは止めた時刻で数える
- テスト送信（`is_test`）は数にも分母にも入れない。予約中・取り消した予約は入れない。取り下げた回は数える
- 写した前のお知らせの回（source `legacy.notification`）は既読の数だけに使う（送り・到達の数に入れない）
- 前の期間 = 同じ長さの直前（summary と breakdown、`comparison.changeRate`）

### 軸

- 軸: 日（series）・経路・定義（message）・種類（category）・テンプレート（template、見出しはテンプレートの名前）・タグ（tag、回のタグごと。タグの無い回は key null）・回（dispatches）。配信停止の結び付きの無い行（好みのページ・前のトークン）は定義・回・テンプレート・タグの軸で key null（「結び付き無し」）。

### 取れない物

- 配達の行は保持の日数（messaging の `retention.deliveriesDays`、既定 90 日）で消える: それより前に送った範囲は `delivered` 〜 `clicked` が `null`（`detailRetained: false`、0 ではない）。回の数・既読・配信停止は残る
- bounce の hard / soft の区別は配達の行に無い（`message_events` の種類だけ、保持 30 日）。`bounced` は合わせた数
- 全員・ロール宛ての共有のお知らせは配達の行が無い: 数は回の `channel_counts.inApp` だけ（到達・開封は無い）
- 配信停止は今ある行だけ（好みのページで戻すと行が消え、数から外れる）。定義・回への結び付きは結んだトークン（`mk` / `d`）からの停止だけで、それより前の停止と好みのページの停止は結び付き無し
- 全部既読（watermark）で読んだお知らせには既読の時刻が無い（既読の数だけ）
