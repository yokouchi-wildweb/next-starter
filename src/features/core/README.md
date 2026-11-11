# core ドメイン一覧

upstream（ベーステンプレート）が提供する基盤ドメインの索引。新しい機能を作る前に、ここで同じものが無いかを確認する（CLAUDE.md `reuse_check`）。

- core = Tier1 が出荷するドメイン。上流の持ち物で、fork は足さない・書き換えない(受け口の項目と override だけ)。手書きか生成かは定義に含まない
- import は `@/features/<domain>` と書ける（tsconfig の paths で `core/` を省略）
- core の UI = 細かい部品と既定のコンテナ。部品は全部公開で、読むのは入口だけ(CLAUDE.md `core_ui`)

README があるものはリンク先が一次資料。README が無いものは、関連ドメインの README かコードを直接参照する。

## 認証・ユーザー

| ドメイン | 役割 |
|---|---|
| [auth](auth/README.md) | 認証・セッション・ページ / API の認可ガード（3 層フロー） |
| [user](user/README.md) | ユーザーテーブル、ロール、ステータス、表示名、退会時クリーンアップ |
| [userProfile](userProfile/README.md) | ロール別プロフィール |
| userTag | ユーザーへのタグ付け（管理用） |
| userLineProfile / userXProfile | LINE / X アカウント連携のプロフィール（ログイン手段ではなく紐付け。auth README 参照） |
| [pairedDevice](pairedDevice/README.md) | 共有端末（店舗タブレット・キオスク）をユーザーとは別の認証主体として登録し、端末トークンで動かす（createDeviceRoute / deviceGuard） |
| [userLoginEvent](userLoginEvent/README.md) | ログイン・サインアップ・ログアウトの記録（IP 軸の突き合わせ） |
| [accountLifecycle](accountLifecycle/README.md) | 休会・退会・休会からの復帰（本人の手続き）。表なし、状態は user の列。機能 pause・withdraw が住所を閉じ、復帰は常に開 |
| [phoneVerification](phoneVerification/README.md) | SMS 認証（電話番号の認証、Firebase Phone Auth）。表なし、認証済みの印は user の列。機能 phoneVerification（上流の既定 閉） |
| [userAcquisition](userAcquisition/README.md) | サインアップまでの流入経路（UTM・広告 ID・リファラー） |
| [referral](referral/README.md) | 招待コードと紹介関係 |
| [referralReward](referralReward/README.md) | 紹介成立時の報酬配布の状態管理 |

## お金・購入

| ドメイン | 役割 |
|---|---|
| [wallet](wallet/README.md) | アプリ内通貨（ポイント・コイン等）の残高・有効期限・失効通知 |
| walletHistory | ウォレットの増減履歴（wallet README 参照） |
| [purchaseRequest](purchaseRequest/README.md) | 外部決済を伴う購入の状態遷移・二重購入防止・purchase_type。**決済プロバイダの追加は [payment/README.md](purchaseRequest/services/server/payment/README.md)** |
| [bankTransferReview](bankTransferReview/README.md) | 自社受付の銀行振込の申告と管理者レビュー |
| [purchaseQuota](purchaseQuota/README.md) | 期間内の購入金額の上限 |
| [coupon](coupon/README.md) | クーポンの発行・管理・使用（entry_scope） |
| couponHistory | クーポン使用履歴 |
| [couponAttributionReward](couponAttributionReward/README.md) | 帰属付きクーポンの消込時に発行者へ報酬 |
| [couponIssuerGrant](couponIssuerGrant/README.md) | クーポン発行権の申請・承認・定期発行 |

## 連絡・通知

| ドメイン | 役割 |
|---|---|
| [messaging](messaging/README.md) | 連絡（メール・お知らせ・fork の経路）。連絡の定義 + 送る口 `messagingService.sendMessage` / `sendMessageToMany`（回・配達の記録・配信停止）、受け取り箱、管理の一括送信と回の読む口 |
| [chatRoom](chatRoom/README.md) | Firestore ベースのリアルタイムチャット |

## 計測・集計・不正対策

| ドメイン | 役割 |
|---|---|
| [analytics](analytics/README.md) | 時系列の集計、DAU、集計キャッシュとロールアップ |
| [userCounter](userCounter/README.md) | ユーザー × キーのカウンタ（累計・日次） |
| [interactionTracking](interactionTracking/README.md) | コンテンツ × 行動のイベント記録（匿名可） |
| [milestone](milestone/README.md) | 条件達成の検知と記録 |
| [deviceFingerprint](deviceFingerprint/README.md) | デバイス軸の突き合わせ（不正の疑い） |
| [fingerprintChallenge](fingerprintChallenge/README.md) | 疑わしいユーザーへの回答フォーム送付と提出時の収集 |
| [legal](legal/README.md) | 法務の文書(利用規約・プライバシーポリシー・特商法の表示)の例文・印 sample / own・差し込み済みの文書・本番の検査(表なし) |
| [rateLimit](rateLimit/README.md) | IP ベースのリクエスト制限 |

どれを使うか迷ったら CLAUDE.md の COUNTING を先に見る。

## 運用・基盤

| ドメイン | 役割 |
|---|---|
| [auditLog](auditLog/README.md) | 監査ログ（誰が・いつ・何を・何が変わったか） |
| [setting](setting/README.md) | 管理者が稼働中に変える設定（シングルトン、キーごとのファイルで拡張） |
| [storageObject](storageObject/README.md) | ファイル台帳（アップロード権の発行・commit・取り消し・非公開ファイルの都度認可の読み取り・業務行への紐付け） |
| [batchJob](batchJob/README.md) | 大量データのチャンク分割処理 |
| [cronCheckpoint](cronCheckpoint/README.md) | 差分 cron / 再開可能バッチのチェックポイント |
| [taskRun](taskRun/README.md) | pnpm task の実行の記録（止める鍵・結果不明、HTTP なし） |
| [incrementalRefresh](incrementalRefresh/README.md) | 派生テーブル（read-model）の差分再計算 |
| [adminCommand](adminCommand/README.md) | 管理者用コマンドパレット |
| admin | 管理画面の取得本体（`services/server/screenData/`。生成される管理画面の loader.ts が `src/wiring/adminScreenParts.ts` の組を通して使う）とダッシュボード、管理メニューの受け口（`menu/`: カテゴリー・項目のファイルと組み立て器、`menu/README.md`） |

## エンティティに列を追加・変更するとき

core ドメインは手で保守するため、`entities/drizzle.ts` だけを変えると型・検証・画面が取り残される（業務ドメインは `pnpm generate domain` が同期するので対象外）。先に `grep -rln "<エンティティ名>" src/` で使っている場所を全部洗い出し、次を確かめる。

1. `entities/drizzle.ts`（テーブル定義）
2. `entities/model.ts`（TypeScript の型）
3. `entities/schema.ts`（Zod の Create / Update スキーマ）
4. `entities/form.ts`（あれば。フォームの型）
5. `presenters.ts`（表示の整形）
6. `services/server/wrappers/` と独自サービス（列名を直接書いたクエリ）
7. `components/common/`（詳細モーダル・タイムライン等で見せるべきか）
8. 管理画面 `src/app/admin/(protected)/<route>/_screen/`（一覧の列・検索フィルタに入れるべきか）
9. `src/app/api/**/route.ts`（レスポンスの型が推論で追従しているか）
10. 他ドメインからの呼び出し元（任意の列なら変更不要のことが多い）
11. 秘密の列なら `defineHiddenColumns` と監査の denylist（`src/lib/audit/denylist.ts`）

新しいテーブルの schemaRegistry 登録と、index を変えたときの db:push 往復確認は CLAUDE.md の DOMAINS を参照。
