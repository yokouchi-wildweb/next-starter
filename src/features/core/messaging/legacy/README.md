# messaging/legacy

前のお知らせ(notification・notificationTemplate のドメイン、S2 で消した)の表の定義だけを置く。

- 表: `notifications`・`notification_reads`・`notification_read_states`・`notification_templates` と enum `notification_target_type_enum`・`notification_sender_type_enum`・`notificationTemplate_category_enum`
- 置く理由: schemaRegistry に載せて `pnpm db:push` が表を消さないようにする(D55)。写しの task が中身を新しい受け取り箱(`message_inbox_items` など)へ写す
- サービス・API・読み手は無い。ここから import しない(写しの task `scripts/migrations/lib.legacyCopyStore.ts` だけが読む。手順は ../README.md「旧お知らせの写し」)
- 名前・FK の名前・index は前と同じ(push の差分を出さない)。変えない
- S3 の初めに、写しを終えた後で表ごと消す
