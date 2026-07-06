# userAcquisition — サインアップ流入経路（マルチタッチアトリビューション）

ユーザーがサインアップ完了するまでの流入タッチ（UTM パラメータ / 広告クリック ID / 外部リファラー）を
サービス側 DB に保存する core ドメイン。GA に依存せず first-touch / last-touch / パス分析を自前データで行える。

**デフォルト無効（オプトイン）。** 必要になった downstream が `acquisition.config.ts` の `enabled: true` で有効化する。
有効化した時点以降のサインアップから蓄積される（過去のサインアップには遡及できない）。
集計 UI は core に同梱しない — 各プロジェクトが下記の読み取り API と集計レシピを使って管理画面等に自作する。

## 仕組み（全体フロー）

```
訪問者（匿名）                             サインアップ本登録
──────────────────────────────           ─────────────────────────────────
UTM / クリックID / 外部リファラー付き        POST /api/auth/register
ページ閲覧のたびに proxy が                  → cookie をサーバーサイドで復元
httpOnly cookie (acq_touches) に            → register() → recordSignupAcquisition()
タッチを追記（DB 書き込みなし）               → user_acquisitions / user_acquisition_touches へ確定保存
                                            → cookie 削除
```

- **cookie 蓄積**: `src/proxies/attribution.ts`（proxy のレスポンスデコレーター）
- **cookie コーデック**: `lib/attributionCookie.ts`（edge-safe。drizzle を import しないこと）
- **確定保存**: `services/server/recordSignupAcquisition.ts`（bestEffort — 失敗しても登録をブロックしない）
- **設定**: `src/config/app/acquisition.config.ts`（enabled / cookieMaxAgeDays=30 / maxTouches=15 / clickIdParams）

## テーブル設計

| テーブル | 関係 | 役割 |
| --- | --- | --- |
| `user_acquisitions` | users と 1:1 | first/last タッチを型付きカラムに非正規化したサマリー。集計はこちら |
| `user_acquisition_touches` | users と 1:N | 全タッチの明細（touch_index 昇順 = 時系列）。パス分析・線形配分用 |

設計方針:

- **集計軸（source / medium / campaign / referrer_host）は型付きカラム** — GROUP BY・インデックスが直接効く
- **ロングテール（utm_term / utm_content / gclid / gaClientId 等）は extras(jsonb)** — 集計軸に昇格したくなった値だけ将来カラム化
- 行が無いユーザー = 計測可能な流入シグナル無し（オーガニック直訪のみ）
- 再入会（withdrawn → active）時は新しい獲得ジャーニーとして上書き
- users テーブル本体には解析用カラムを足さない。今後も解析系のユーザー属性は関心事ごとにサテライトテーブルを新設する（本ドメインがその先例）

## タッチの記録ルール（cookie 側）

- 対象: GET のページナビゲーションのみ（/api/・/_next/・アセットは除外）
- タッチ条件: `utm_*` あり / 既知のクリック ID あり / 外部リファラーあり
- source/medium 補完（GA 慣例）: UTM 無し+クリック ID → config の対応表、UTM 無し+外部リファラーのみ → `source=リファラーホスト, medium=referral`
- 重複抑止: 直前タッチと同一チャンネル（source/medium/campaign/referrer_host）は追記しない
- 上限: `maxTouches`（既定 15）超過・4KB 逼迫時は **first-touch を必ず保持**して古い中間タッチから間引く
- 有効期限: 追記のたびにリフレッシュ = 最終タッチから `cookieMaxAgeDays`（既定 30 日）

## 読み取り API（server-only）

```ts
import {
  getUserAcquisition,        // 1:1 サマリー（無ければ null）
  getUserAcquisitionTouches, // タッチ明細（時系列昇順）
} from "@/features/userAcquisition/services/server";
```

## 集計レシピ

### first-touch 別サインアップ数（期間指定）

```sql
SELECT COALESCE(first_utm_source, '(direct/none)') AS source,
       COALESCE(first_utm_medium, '(none)')        AS medium,
       COUNT(*)                                    AS signups
FROM user_acquisitions
WHERE signup_at >= '2026-07-01' AND signup_at < '2026-08-01'
GROUP BY 1, 2
ORDER BY signups DESC;
```

last-touch 集計は `first_` を `last_` に読み替えるだけ。
「シグナル無し（行が無い）ユーザー」も分母に含めたい場合は users から LEFT JOIN する。

### タッチ経路（パス）分析

```sql
SELECT path, COUNT(*) AS users
FROM (
  SELECT user_id,
         STRING_AGG(COALESCE(utm_source, referrer_host, '(direct)'), ' > ' ORDER BY touch_index) AS path
  FROM user_acquisition_touches
  GROUP BY user_id
) t
GROUP BY path
ORDER BY users DESC
LIMIT 50;
```

### ダッシュボード常設化する場合

単発クエリなら上記で十分。管理画面に常設するなら（ANALYTICS_PERF 参照）:

1. まず `withAnalyticsCache` でクエリ結果をキャッシュ
2. 日次系列が必要になったら `analyticsRollupRegistry` に flow メトリクス（例: `signup_by_source`、dimensions=first_utm_source）を登録して事前集計に載せる

## UI について

core ドメインのため UI は同梱しない（データレイヤーのみ）。
管理画面のユーザー詳細に表示する場合は、`getUserAcquisition` / `getUserAcquisitionTouches` を
SSR ページまたは管理 API から呼び出して downstream 側で描画する。

## 注意事項

- cookie はクライアント改ざんが可能。zod で形式・長さは検証するが値の真正性は保証しない（解析用データとして許容）
- redirect 等のインターセプト系 proxy が応答したリクエストではタッチを拾えない（リダイレクト後の着地 URL に UTM を残す運用を推奨）
- `_ga` cookie が存在すれば client_id をサマリー extras（`gaClientId`）に保存する — GA 側データとの突合用
- 無効化: `acquisition.config.ts` の `enabled: false`（cookie 蓄積・保存とも停止。既存データはそのまま）
