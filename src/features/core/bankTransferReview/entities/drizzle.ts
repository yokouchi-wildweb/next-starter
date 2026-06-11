// src/features/core/bankTransferReview/entities/drizzle.ts
//
// 自社銀行振込（inhouse プロバイダ）でユーザーが申告した振込完了の管理者レビュー記録。
//
// 設計方針:
// - purchase_requests に銀行振込固有のカラムを生やさず、責務を分離した独立テーブルとして管理する。
// - 1 purchase_request : 1 review の関係（UNIQUE 制約）。再申告は同一レコードを更新する想定。
// - mode (immediate / approval_required) はレコード作成時の paymentConfig.bankTransfer.autoComplete から
//   決定して固定する。後から設定が変わってもレビューの semantics が一貫するように。
// - reviewed_by は管理者退職時にユーザーが消えてもレビュー履歴自体は残せるよう ON DELETE SET NULL。
// - 拡張用に metadata (jsonb) を持たせる（再レビュー履歴・追加コメント等の将来拡張余地）。

import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";

/**
 * レビューの状態。
 * - pending_review: ユーザーが申告済みで管理者の判定待ち
 * - needs_check: CSV 一括取込等で「自動承認はできないが、管理者の追加判断を要する」と
 *   判定された中間ステータス。pending_review と同じく承認 (confirmed) / 拒否 (rejected) 両方への
 *   遷移が可能。pending_review に戻すフローは設けない（一度フラグが立ったものは
 *   人間の判断で確定させる方針）。
 * - investigating: needs_check 以上に踏み込んだ追加検証が必要なケース。
 *   ユーザー側へ停止措置等の運用対応を伴う重大ケースの管理用中間ステータス。
 *   pending_review / needs_check の双方から遷移可能で、ここから confirmed / rejected
 *   への確定もできる。pending_review / needs_check への巻き戻しは設けない。
 * - confirmed: 管理者が振込実在を確認済み
 * - rejected: 管理者が振込未確認と判断（運用で別途対応）
 */
export const BankTransferReviewStatusEnum = pgEnum(
  "bank_transfer_review_status_enum",
  ["pending_review", "needs_check", "investigating", "confirmed", "rejected"],
);

/**
 * レビューの動作モード。
 * - immediate: ユーザー申告時に通貨を即時付与する（purchase_request は申告時点で completed）。
 *   管理者承認は事後の振込確認の意思表示で、通貨付与には連動しない。
 * - approval_required: 管理者承認まで通貨付与を保留する（purchase_request は申告後も processing）。
 *   管理者承認時に completePurchase が走り通貨が付与される。拒否は failPurchase に連動。
 *
 * mode はレコード作成時の paymentConfig.bankTransfer.autoComplete から決定し、
 * 以後不変（途中で設定が変わっても既存レビューは作成時のモードで動く）。
 */
export const BankTransferReviewModeEnum = pgEnum(
  "bank_transfer_review_mode_enum",
  ["immediate", "approval_required"],
);

export const BankTransferReviewTable = pgTable(
  "bank_transfer_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * 関連する購入リクエスト。1 対 1（UNIQUE）。
     * purchase_request 削除時はレビューも cascade で削除する。
     *
     * 注: FK 制約は (table) => [foreignKey(...)] 側で明示名を指定して定義する。
     * drizzle が自動生成する `<table>_<col>_<reftable>_<refcol>_fk` だと PostgreSQL の
     * 識別子上限 63 文字を超えて切り詰め警告が出るため、明示的に短い名前を割り当てる。
     */
    purchase_request_id: uuid("purchase_request_id").notNull().unique(),
    /**
     * 申告ユーザー。本人認可と一覧画面のフィルタ用にここにも保持する
     * （JOIN 回避と user_id 単独 index 利用のため）。
     */
    user_id: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    status: BankTransferReviewStatusEnum("status").notNull().default("pending_review"),
    mode: BankTransferReviewModeEnum("mode").notNull(),
    /**
     * ユーザーが申告時に添付した振込明細画像の URL（Firebase Storage 想定）。
     * origin 検証は別スコープで後付け予定。
     */
    proof_image_url: text("proof_image_url").notNull(),
    submitted_at: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * レビュー実施した管理者ユーザー。退職時にユーザーレコードが削除されても
     * レビュー履歴は残せるよう ON DELETE SET NULL。
     */
    reviewed_by: uuid("reviewed_by").references(() => UserTable.id, {
      onDelete: "set null",
    }),
    reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
    /**
     * 承認操作の入力経路を記録する。confirmed に遷移した瞬間に確定し、以後不変。
     * - manual: 管理者が画面で「承認」ボタンを押した
     * - csv_auto: CSV 一括取込で金額一致と判定され自動承認された
     * - null: 未承認 / 拒否確定 / 機能リリース前の既存 confirmed レコード（不明扱い）
     *
     * 値の列挙は schema.ts の `BANK_TRANSFER_REVIEW_APPROVAL_SOURCES` で管理する。
     * needs_check を経由して最終的に手動承認されたケースは `manual` とする
     *  （「最終的に承認に移動した際の操作主体」で判定し、以前の経緯は audit_log で追う）。
     */
    approval_source: text("approval_source"),
    /** 拒否時の理由（confirmed の場合は null） */
    reject_reason: text("reject_reason"),
    /**
     * 管理者が手書きで残すメモ。CSV 取込時の自動追記には使わず（自動文言は
     * needs_check_reason / needs_check_context 側で構造化保存する）、
     * 純粋に管理者の自由メモとして発送リクエストの admin_memo と同等の運用。
     */
    admin_memo: text("admin_memo"),
    /**
     * needs_check に遷移した理由のコード。`amount_mismatch` 等。
     * 値は schema.ts の `BANK_TRANSFER_REVIEW_NEEDS_CHECK_REASONS` で列挙する。
     * UI のバッジ表示・集計の絞り込みに使う。pending_review / confirmed / rejected では
     * 通常 null だが、confirmed/rejected 後も「どの理由から最終判断に至ったか」の
     * 履歴として残し続ける（クリアしない）。
     */
    needs_check_reason: text("needs_check_reason"),
    /**
     * needs_check 理由の詳細（理由コードによってスキーマが異なる）。
     * 例: `amount_mismatch` の場合 `{ csvAmount: number; expectedAmount: number }`。
     * UI で「CSV: ¥1,500 / 期待: ¥1,000」のような補足表示に使う。
     * 監査用にレビュー履歴中も保持。コアロジックは中身を解釈しない。
     */
    needs_check_context: jsonb("needs_check_context"),
    /**
     * 拡張用メタデータ。再レビュー履歴・追加コメント・添付ファイル多数化等を
     * カラム追加せず取り込む将来余地として保持。コアロジックは中身を解釈しない。
     */
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // purchase_request_id への FK は明示名で短縮（自動生成名は 63 文字超）
    foreignKey({
      columns: [table.purchase_request_id],
      foreignColumns: [PurchaseRequestTable.id],
      name: "bank_transfer_reviews_purchase_request_id_fk",
    }).onDelete("cascade"),
    // 一覧画面の status タブ切替（pending_review / confirmed / rejected）用
    index("bank_transfer_reviews_status_idx").on(table.status),
    // ユーザー視点の進行中振込検出（同一ユーザーの pending_review 検索）用
    index("bank_transfer_reviews_user_id_idx").on(table.user_id),
    // 古い順 / 新しい順ソート用
    index("bank_transfer_reviews_submitted_at_idx").on(table.submitted_at),
  ],
);
