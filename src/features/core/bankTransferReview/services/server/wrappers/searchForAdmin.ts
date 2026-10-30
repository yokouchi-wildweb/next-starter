// src/features/core/bankTransferReview/services/server/wrappers/searchForAdmin.ts
//
// 管理者向けのレビュー一覧(GET /api/admin/bank-transfer-reviews の取得部分)。
// 一覧 + 関連 purchase_request + 申告ユーザー(表示用フィールド)+ 氏名プロファイル(あれば)+ 件数。

import { and, count, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import type { BankTransferReviewMode, BankTransferReviewStatus } from "@/features/bankTransferReview/entities/model";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { PROFILE_TABLE_MAP } from "@/registry/profileTableRegistry";

// 氏名（lastName / firstName）を持つプロファイルテーブルをプロジェクト構成から動的検出する。
// プロファイルは role:generate でプロジェクト毎に生成されるため、列の有無を実行時に判定し、
// 該当プロファイルが無いプロジェクトでは氏名 null（UI 上は「—」）で返す。
const NameProfileTable = Object.values(PROFILE_TABLE_MAP).find(
  (table) => "lastName" in table && "firstName" in table,
);

export type AdminBankTransferReviewQuery = {
  status?: BankTransferReviewStatus;
  mode?: BankTransferReviewMode;
  userId?: string;
  /** 承認番号 (provider_order_id) / ユーザー名 / メール / 電話番号 を横断 ILIKE 検索。空文字は未指定扱い */
  searchQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
};

export async function searchForAdmin(query: AdminBankTransferReviewQuery) {
  const { status, mode, userId, searchQuery, dateFrom, dateTo, page, limit } = query;
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(BankTransferReviewTable.status, status));
  if (mode) conditions.push(eq(BankTransferReviewTable.mode, mode));
  if (userId) conditions.push(eq(BankTransferReviewTable.user_id, userId));
  if (dateFrom) {
    conditions.push(gte(BankTransferReviewTable.submitted_at, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(BankTransferReviewTable.submitted_at, new Date(dateTo)));
  }
  // フリーキーワード検索: 承認番号 / ユーザー名 / メール / 電話番号 を ILIKE 横断
  // ILIKE のワイルドカード（% _）はバックスラッシュでエスケープしてユーザー入力を
  // パターンとして悪用されないようにする。
  const trimmedQuery = searchQuery?.trim();
  if (trimmedQuery) {
    const escaped = trimmedQuery.replace(/[\\%_]/g, (c) => `\\${c}`);
    const pattern = `%${escaped}%`;
    conditions.push(
      sql`(
        ${PurchaseRequestTable.provider_order_id} ILIKE ${pattern} OR
        ${UserTable.name} ILIKE ${pattern} OR
        ${UserTable.email} ILIKE ${pattern} OR
        ${UserTable.phoneNumber} ILIKE ${pattern}
      )`,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // 並び順: 終端ステータス (承認済み / 拒否) は判定日時 (reviewed_at) の新しい順。
  // それ以外 (レビュー待ち / 要確認 / 検証中) は従来通り申告日時の新しい順。
  // reviewed_at 同値時のページングちらつき防止に submitted_at を第2キーに使う。
  const orderByColumns =
    status === "confirmed" || status === "rejected"
      ? [
          desc(BankTransferReviewTable.reviewed_at),
          desc(BankTransferReviewTable.submitted_at),
        ]
      : [desc(BankTransferReviewTable.submitted_at)];

  // 一覧取得 + 関連 purchase_request + 申告ユーザー（表示用フィールド）を JOIN
  // 同一トランザクションでなくてよいため count は別クエリ。
  const rows = await db
    .select({
      review: BankTransferReviewTable,
      purchaseRequest: {
        id: PurchaseRequestTable.id,
        payment_amount: PurchaseRequestTable.payment_amount,
        amount: PurchaseRequestTable.amount,
        wallet_type: PurchaseRequestTable.wallet_type,
        status: PurchaseRequestTable.status,
        provider_order_id: PurchaseRequestTable.provider_order_id,
        completed_at: PurchaseRequestTable.completed_at,
      },
      user: {
        id: UserTable.id,
        name: UserTable.name,
        email: UserTable.email,
      },
    })
    .from(BankTransferReviewTable)
    .leftJoin(
      PurchaseRequestTable,
      eq(BankTransferReviewTable.purchase_request_id, PurchaseRequestTable.id),
    )
    .leftJoin(
      UserTable,
      eq(BankTransferReviewTable.user_id, UserTable.id),
    )
    .where(where)
    .orderBy(...orderByColumns)
    .limit(limit)
    .offset((page - 1) * limit);

  // 氏名プロファイルを別クエリで取得してマージする。
  // 動的検出したテーブルを JOIN に混ぜると select の型推論が崩れるため 2 クエリ構成にする。
  const profileByUserId = new Map<
    string,
    { lastName: string | null; firstName: string | null }
  >();
  if (NameProfileTable) {
    const userIds = [...new Set(rows.map((row) => row.review.user_id))];
    if (userIds.length > 0) {
      const profiles = await db
        .select({
          userId: NameProfileTable.userId,
          lastName: NameProfileTable.lastName,
          firstName: NameProfileTable.firstName,
        })
        .from(NameProfileTable)
        .where(inArray(NameProfileTable.userId, userIds));
      for (const profile of profiles) {
        profileByUserId.set(profile.userId as string, {
          lastName: (profile.lastName ?? null) as string | null,
          firstName: (profile.firstName ?? null) as string | null,
        });
      }
    }
  }

  const items = rows.map((row) => ({
    ...row,
    userProfile: profileByUserId.get(row.review.user_id) ?? null,
  }));

  // count 用クエリも検索 WHERE が PurchaseRequest / User 列を参照するため、
  // 同じ JOIN を張ってから集計する。
  const totalRows = await db
    .select({ total: count() })
    .from(BankTransferReviewTable)
    .leftJoin(
      PurchaseRequestTable,
      eq(BankTransferReviewTable.purchase_request_id, PurchaseRequestTable.id),
    )
    .leftJoin(
      UserTable,
      eq(BankTransferReviewTable.user_id, UserTable.id),
    )
    .where(where);
  const total = totalRows[0]?.total ?? 0;


  return {
    items,
    total,
    page,
    limit,
    // 氏名プロファイルがプロジェクト構成に存在するか。false のとき UI は
    // 氏名カラムごと非表示にする（プロファイルを持たないテンプレート/フォークでは
    // 全行「未登録」の無意味な列になるため）。プロファイルを後から追加すると
    // 動的検出により自動で true になりカラムが現れる。
    profileNameAvailable: NameProfileTable !== undefined,
  };
}
