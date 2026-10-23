# storage 呼び出し箇所の切り替え（N2 T10）の手動確認

> owner: next-starter

storage 再設計の N2 区間 T10 で、upstream の呼び出し箇所を新しい storage 基盤（`storage://` ref・ファイル台帳・GCS 署名直送）に切り替えた。そのときのブラウザでの確認手順と結果を残す。dataMigration（import / export）は別の歩（13b）で扱うため、ここには含めない。

## 前提

- 保留ブランチ `legate/20261022-121853-storage-authority-policy-redesign.1` で開発サーバーを動かす
- `.env.development` に試験バケットの `STORAGE_PUBLIC_BUCKET` / `STORAGE_PRIVATE_BUCKET` / `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` を入れる
- ブラウザの開発者ツール（Network）で `/api/me/storage/uploads`（発行）・GCS への PUT・`/commit`・`/api/storage/objects/<id>`（302）を見る
- 台帳は `pnpm db:query "select id, purpose, status, reason, record_type, record_id, record_field, object_removed_at from storage_objects order by created_at desc limit 10"` で見る

## 手順

1. アバター（一般利用者でログイン）
   - `/mypage/account` でアバターを押して画像を選ぶ → 表示が変わる
   - 台帳: `user.avatar` の行が `ready`、`record_type = user`、`record_field = avatarUrl`
   - 「画像を削除」→ 表示が消え、台帳の行が `deleted / replaced`
   - 期待: 発行 200 → PUT 200 → commit 200 → `PATCH /api/me/profile` 200
2. 振込証明（一般利用者。自社銀行振込が有効な構成）
   - `/wallet/<slug>/purchase` で銀行振込を選び、`/wallet/<slug>/purchase/bank-transfer/<requestId>` へ進む
   - ② で画像を添付 → 差し替え（もう 1 枚）→ 申告まで進む。確認モーダルに画像が出る
   - 台帳: 差し替え前の画像は `deleted / discarded`、申告した画像は `record_type = bankTransferReview`
   - 管理者で `/admin/bank-transfer-reviews/pending_review` を開き、詳細で画像が出る・クリックで拡大できる（`/api/storage/objects/<id>` → 302）
3. coupon 管理フォーム（管理者）
   - `/admin/coupons` で新規作成または編集 → 画像をアップロードして保存 → 一覧・編集画面で画像が出る
   - 「purpose 未設定」の表示が出ないこと
4. お知らせ送信（管理者）
   - `/admin/notifications/send` で画像付きのお知らせを送る
   - 台帳: `notification.image` の行が `record_type = notification`、`record_field = image`（紐付かないと 24 時間後に掃除で消える）
5. デモ（管理者）
   - `/demo/media-input` の MediaUpload / MediaUploaderMulti で画像をアップロードできる
   - `/demo/seamless-av` でフラグメントを保存し、`/demo/seamless-av/play` で再生できる
   - 一般利用者・debugger アカウントでは 403（`demo.media` は管理者のみ）
6. チャット（一時の debug ページ `/debug/storage-chat`。commit しない）
   - 参加している roomId を入れて「開く」→ 画像・動画・ファイルを送る → 表示・再生・ダウンロードできる
   - 参加していないルームの roomId では発行が 403
   - 送信中に「中止」→ 台帳の行が `deleted / discarded`

## 結果（2026-10-23、Chromium を Playwright で操作。人がログインを切り替え）

確認のあいだだけ、次の設定値を一時的に変えて戻した（commit していない）: `avatarEnabled: true`（アバター欄の表示）、`enableAdminBroadcast: true`（お知らせ送信画面）、支払い方法 `bank_transfer_inhouse` の `status: "available"`（管理画面の振込レビュー）。

1. アバター（admin のリーリエ）
   - 最初は保存されなかった: `PATCH /api/me/profile` は 200 だが avatarUrl が落ちていた。update ラッパーは操作者が admin だと `UserUpdateByAdminSchema` を使い、そこに avatarUrl が無かった（変更前からのバグ。アバター機能が既定 OFF で表に出ていなかった）→ スキーマに avatarUrl を足して直した
   - 直した後: 発行 200 → PUT 200 → commit 200 → PATCH 200、users.avatar_url = ref、台帳 `user / avatarUrl` に紐付き。「画像を削除」で null、台帳は `deleted / replaced`（tx 付きの更新なので実物は storage-sweep が消す）
   - 縦長の画像が楕円に伸びた（AppImage の intrinsic モード + グローバルの `img { height: auto }`）→ 大きさを固定した丸い枠の中に fill モードで置く形に直した
2. 振込証明（一般ユーザー区分のよこよこん、処理中の依頼 `019eb616-…`）
   - 添付 → 差し替え: 前の画像は `deleted / discarded`（discard 200）
   - AI 判定は不承認（単色の試験画像）→「不承認のまま申告する」。確認モーダルの画像は `/api/storage/objects/<id>` 経由で表示
   - 申告後、台帳は `bankTransferReview / proof_image_url`、scope_id = 依頼 ID。レビューは needs_check
   - 管理者（リーリエ）で `/admin/bank-transfer-reviews/needs-check` の詳細: 画像が表示され、クリックで拡大できる（302 → 署名 URL）
3. coupon 管理フォーム（`/admin/coupons/new`）
   - 「purpose 未設定」の表示は出ず、uploader が出る。画像付きで登録 → 台帳 `coupon / image_url` に紐付き、編集画面で公開 URL の画像が表示
   - storage とは別件: カテゴリを選ばないと settings が空文字のままで、zod エラーがどこにも表示されずに送信が止まる（変更前からの不具合）
4. お知らせ送信（`/admin/notifications/send`、宛先はよこよこん 1 人）
   - `POST /api/notification/send` 200、台帳 `notification / image` に紐付き（直接 insert の sendDirect が同じ TX で binding を通す）
5. デモ（`/demo/media-input`、admin）
   - MediaUpload / MediaUploaderMulti とも発行 → commit 200、公開 URL で表示
   - seamless-av は fragmented MP4 の素材が無く、未確認
6. チャット（一時ページ `/debug/storage-chat`。Firestore に確認用ルームを作り、確認後に削除）
   - 参加者として画像・ファイルを上げると発行・commit 200
   - 固定 URL: 画像は 302 → 表示、ファイルは 200 / attachment
   - 参加者から外すと: 読み取り 404、そのルームへの新しい発行 403
   - 「破棄」で 2 件とも `deleted / discarded`
   - メッセージの Firestore 書き込みは dev の Firestore ルールが拒否した（upstream はルールを同梱しない）→ メッセージ一覧での表示と、動画の送信は未確認

## 気づいたこと

- 開発サーバーは初回のルートのコンパイルに 20〜30 秒かかり、その間の要求は保留になった（コードの問題ではない）
- Turbopack の Fast Refresh が数秒おきに走り続けた。Playwright が書くプロジェクト直下の `.playwright-mcp/` を監視しているのかもしれない（未確認）
