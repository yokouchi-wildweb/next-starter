# core ドメイン一覧

upstream（ベーステンプレート）が提供する基盤ドメインの索引。新しい機能を作る前に、ここで同じものが無いかを確認する（CLAUDE.md `reuse_check`）。

- core ドメインは手で保守する。`domain.json` を持つものもあるが、`dc:generate` の対象ではない
- import は `@/features/<domain>` と書ける（tsconfig の paths で `core/` を省略）
- core はデータレイヤー（エンティティ・サービス・API・フック）までを持ち、画面のデザインは下流に任せる（[docs/!must-read/README.md](../../../docs/!must-read/README.md) §4）

README があるものはリンク先が一次資料。README が無いものは、関連ドメインの README かコードを直接参照する。

## 認証・ユーザー

| ドメイン | 役割 |
|---|---|
| [auth](auth/README.md) | 認証・セッション・ページ / API の認可ガード（3 層フロー） |
| [user](user/README.md) | ユーザーテーブル、ロール、ステータス、表示名、退会時クリーンアップ |
| [userProfile](userProfile/README.md) | ロール別プロフィール |
| userTag | ユーザーへのタグ付け（管理用） |
| userLineProfile / userXProfile | LINE / X アカウント連携のプロフィール（ログイン手段ではなく紐付け。auth README 参照） |
| [userLoginEvent](userLoginEvent/README.md) | ログイン・サインアップ・ログアウトの記録（IP 軸の突き合わせ） |
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
| [notification](notification/README.md) | お知らせ（全体 / ロール別 / 個別、既読、予約） |
| notificationTemplate | お知らせのテンプレート（管理用） |
| messaging | 管理者からユーザーへのメッセージ送信。`messagingService.send` / `bulkSend` 経由が必須（受信者単位の監査と本文の保存のため。CLAUDE.md PROHIBITED） |
| [mail](mail/README.md) | メール送信（Resend）。システムメール用 |
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
| [rateLimit](rateLimit/README.md) | IP ベースのリクエスト制限 |

どれを使うか迷ったら CLAUDE.md の COUNTING を先に見る。

## 運用・基盤

| ドメイン | 役割 |
|---|---|
| [auditLog](auditLog/README.md) | 監査ログ（誰が・いつ・何を・何が変わったか） |
| [setting](setting/README.md) | アプリ全体の設定（シングルトン、Zod で拡張） |
| [batchJob](batchJob/README.md) | 大量データのチャンク分割処理 |
| [cronCheckpoint](cronCheckpoint/README.md) | 差分 cron / 再開可能バッチのチェックポイント |
| [incrementalRefresh](incrementalRefresh/README.md) | 派生テーブル（read-model）の差分再計算 |
| [adminCommand](adminCommand/README.md) | 管理者用コマンドパレット |
| admin | 管理画面の共有 loader（`services/server/loaders/`。生成される管理画面が使う） |
| insane | 管理者用の危険操作（ドメインのテーブル全消去など） |
