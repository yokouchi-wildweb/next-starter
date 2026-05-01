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
 * - confirmed: 管理者が振込実在を確認済み
 * - rejected: 管理者が振込未確認と判断（運用で別途対応）
 */
export const BankTransferReviewStatusEnum = pgEnum(
  "bank_transfer_review_status_enum",
  ["pending_review", "confirmed", "rejected"],
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
    /** 拒否時の理由（confirmed の場合は null） */
    reject_reason: text("reject_reason"),
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
