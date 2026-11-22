# analytics API

## Overview

- analytics の組み込み API のクエリパラメータとレスポンスの仕様(API の一覧は README.md の Overview)

## API

### 共通クエリパラメータ

日付範囲（status-overview以外の全APIで共通）:
- `days`: 日数指定（デフォルト 30）
- `dateFrom`: 開始日（YYYY-MM-DD）
- `dateTo`: 終了日（YYYY-MM-DD）
- `timezone`: タイムゾーン（IANA TZ名、デフォルト: `Asia/Tokyo`）
- `granularity`: 集計粒度。`hour` / `day` / `week` / `month`（デフォルト: `day`）
- `alignToGranularity`: `true`（または `1`）で dateFrom を粒度のバケット開始境界（week=ISO月曜、month=月初）へ floor する。デフォルト off。先頭の不完全バケットがフロー系メトリクスで過少表示されるのを防ぐ用途
- dateFrom + dateTo 指定時は days より優先

集計粒度（granularity）の挙動:
- 時系列集計 API (`*/daily`, `wallet-history/balance` 等) のバケット単位を切り替える
- `history[].date` の書式は粒度で変わる: hour=`YYYY-MM-DDTHH:00`, day=`YYYY-MM-DD`, week=月曜開始日 `YYYY-MM-DD`, month=`YYYY-MM`
- レスポンスには解決済み `granularity` フィールドが含まれる
- 期間上限は粒度ごと: hour=31日, day=365日, week=2年, month=10年（バケット数の爆発を防ぐ）
- DAU は `day` / `week` / `month` をサポート（week/month はバケット内ユニークユーザー = WAU/MAU）。`hour` は `GranularityNotSupportedError`（DomainError 派生、400）（`UserDailyActivityTable` が日次集計済みのため）
- 期間サマリー API (`*/summary`) では集計に影響しない（期間全体を1つの集計値にする）

ユーザーフィルタ:
- `userId`: 特定ユーザーに絞り込み（ranking以外）
- `roles`: 含めるロール（CSV、ホワイトリスト方式）。未指定=全ロール
- `excludeDemo`: `true` でデモユーザー（is_demo=true）を除外
- `groupBy`（`/wallet-history/daily`）: `reasonCategory`（既定）/ `sourceType` / `changeMethod` / `reasonKey`（付与の種類。種類の無い行は鍵 `unkeyed`）
- `includeExcluded`: `true` で分析の除外条件を足さない（除外の前後を比べる検証用。`services/server/exclusion/README.md`）

フィルタ:
- `walletType`: ウォレット種別でフィルタ（指定なし = 全種別）

### referral summary 固有のパラメータ

- `referralStatuses`: 集計対象とする `referrals.status` を CSV で指定（例: `active,cancelled`）。省略時は全状態をカウント
- リワード金額の抽出 SQL 式は `getReferralSummary()` の `rewardAmountExpr` 引数で差し替え可能。デフォルトは `(referral_rewards.metadata ->> 'amount')::numeric`（rewardHandler が metadata に `amount: number` を入れる規約に従う場合）。下流が異なる metadata 構造を持つ場合は独自の API ルートからカスタム SQL を渡す

### DAU（アクティブユーザー）系

`user_daily_activities`（1 ユーザー × 1 日 = 1 行、ON CONFLICT DO NOTHING で冪等 ingest）を一次データとする、訪問・アクティブ系の read 群。
「DAU / WAU / MAU」「ユーザーごとの訪問日数」「最もアクティブなユーザー」の問いはここで解く（CLAUDE.md COUNTING）。

| 関数（dauAnalytics） | エンドポイント | 返すもの |
|---|---|---|
| `getDauDaily` | GET /api/admin/analytics/dau/daily | バケット別アクティブユーザー数（day=DAU / week=WAU / month=MAU） |
| `getDauSummary` | GET /api/admin/analytics/dau/summary | 期間サマリー（avg/max/min、前期比） |
| `getDauRanking` | GET /api/admin/analytics/dau/ranking | ユーザー別アクティブ日数ランキング |
| `getDauActiveDaysHistogram` | GET /api/admin/analytics/dau/active-days-histogram | アクティブ日数ヒストグラム（activeDays → userCount 分布） |

#### ランキング（getDauRanking）

- パラメータ: 日付範囲共通パラメータ + `limit`（既定 50、最大 200）/ `page`（1 始まり） + ユーザーフィルタ（roles / excludeDemo） + 最終アクティブ日フィルタ（`lastActiveDateFrom` / `lastActiveDateTo`、YYYY-MM-DD・TZ ローカル日付キー、任意）
- レスポンス: `RankingResponse`（`items: [{ rank, userId, displayName, activeDays, lastActiveDate }]` + `total`）
- 並び順: activeDays DESC → lastActiveDate DESC → userId ASC（ページングが安定するよう決定的）
- `(user_id, activity_date)` ユニークのため `COUNT(*)` = 期間内アクティブ日数。`activity_date` index のレンジスキャン + GROUP BY で解決
- 最終アクティブ日フィルタ: 期間内の `MAX(activity_date)` に対する HAVING 絞り込み。`total` も同じ条件のサブクエリで数えるためページネーションは常に整合。集計後の条件のためサーバー側でのみ解決できる（下流でのページ全走査・クエリ複製は不要）
  - チャーンリスク抽出（「期間中は高アクティブだが直近 N 日訪問なし」）: `lastActiveDateTo = 今日 − N 日` を渡す。カットオフ日数（3/7/14 等）の決定は下流ポリシー
  - 復帰・リテンション分析（「X 日以降に戻ってきたユーザー」）: `lastActiveDateFrom = X`

#### アクティブ日数ヒストグラム（getDauActiveDaysHistogram）

- パラメータ: 日付範囲共通パラメータ + ユーザーフィルタ（roles / excludeDemo）。ページネーション不要（行数は期間日数で有界）
- レスポンス: `{ dateFrom, dateTo, totalUsers, histogram: [{ activeDays, users }] }`（users > 0 の行のみ、activeDays ASC。`totalUsers` = 期間内に 1 日以上アクティブだった DISTINCT ユーザー数 = users 合計）
- SQL 形: ユーザーごとのアクティブ日数を集計するサブクエリ → その日数で再 GROUP BY（全て DB 側で解決）
- バケット化（「皆勤 / 80%+ / 50-79% …」等の割合しきい値・ラベル）はプロダクトポリシーなので呼び手が持ち、このヒストグラムをクライアント側で任意の帯にマッピングする

#### ユーザー単位ドリルダウン（userId パラメータ）

daily / summary は `userId` で単一ユーザーに絞り込める（他ドメインの分析 API と同じ共通パラメータ）:

- `dau/summary?userId=X` → `totalActiveRecords` = そのユーザーの期間内アクティブ日数
- `dau/daily?userId=X`（day 粒度） → 0/1 の系列（アクティビティカレンダー・ヒートマップ用途）

#### クライアント / フック

- 記録（ingest）: `hooks/useDauTracker.ts`（1 日 1 回 `POST /api/activity/dau`）
- 読み取り: `services/client/dauAnalyticsClient.ts`（fetchDauDaily / fetchDauSummary / fetchDauRanking / fetchDauActiveDaysHistogram）+ `hooks/useDauDaily.ts` / `useDauSummary.ts` / `useDauRanking.ts` / `useDauActiveDaysHistogram.ts`（SWR）。管理画面のダッシュボード・「アクティブユーザー」タブ等はこれらをそのまま利用する（画面 UI は下流の責務）

### ランキング: ウォレット vs 購入

2つのランキングAPIは異なるデータソースを参照し、異なるユースケースに対応する。

| 観点 | wallet/ranking | purchase/ranking |
|---|---|---|
| データソース | wallet_histories | purchase_requests (status='completed') |
| 日付カラム | createdAt | completed_at |
| ソートパラメータ | `sortBy` | `sortBy` |
| sortBy 候補 | totalPurchase, totalConsumption, purchaseCount, netChange | totalCoinAmount, totalPaymentAmount, purchaseCount, avgPaymentAmount |
| レスポンス | 全指標を常に返す（sortBy はソート順のみ変更） | 全指標を常に返す（sortBy はソート順のみ変更） |
| ユーザー情報 | userId + displayName（users LEFT JOIN） | userId + displayName（users LEFT JOIN） |
| 追加フィルタ | — | paymentProvider |
| デフォルト件数 | 50（最大200） | 20（最大100） |

#### 使い分け

- **サービス内通貨あり**: どちらも利用可能。コイン/ポイント増減の分析には wallet/ranking、決済金額の分析には purchase/ranking
- **直接決済のみ（ECサイト等）**: wallet_histories に購入レコードが存在しないため purchase/ranking のみ使用可能

### ウォレット系: history 軸 vs state 軸

ウォレット分析は2つの軸で構成される。データソースが別なので両方共存する。

| 観点 | history 軸（wallet_histories） | state 軸（wallets） |
|---|---|---|
| データソース | 増減台帳の累積 | 現時点の保有スナップショット |
| 期間概念 | 日付範囲必須（dateFrom/dateTo/days） | スナップショットなので期間なし |
| walletType | optional（クロス集計可、単位は意味依存） | **必須**（型ごとに残高単位が異なる） |
| 提供 API | `/wallet-history/{daily,summary,balance}`, `/wallet/ranking` | `/wallet/state/{summary,ranking,distribution}` |
| 主なユースケース | 期間内の流入・流出、KPI推移 | 現在の流通量・保有者分布、リワード設計 |

#### state 軸の追加要件・補足

- **walletType は必須クエリパラメータ**: 残高（balance）の単位は通貨によって意味が変わる（例: コイン枚数とポイント数は加算しても意味がない）。state 系では `walletType` 未指定はリクエストエラー。
- **保有者の定義**: `balance > 0` のユーザー。`locked_balance` は参考値として `totalLockedBalance` で別途返却する。
- **distribution の boundaries**: `purchase/distribution` と完全に同じ仕様。CSV、昇順、正整数、最大20個。境界外（balance < 先頭境界）は bucket=0 に集約。さらに完全な 0 残高ウォレットは別途 `zeroBalanceCount` として返す。
- **クライアント / フック**: `services/client/walletStateAnalyticsClient.ts` および `hooks/useWalletState{Summary,Ranking,Distribution}.ts` を提供済み。下流ではこれらをそのまま再利用する想定。
- **既定バケット値の扱い**: 上流は持たない。事業ごとに妥当なバケット値が異なるため、呼び手（fork の管理画面等）が `boundaries` を組み立ててクライアント関数に渡す。
