// src/app/api/admin/bank-transfer-reviews/[id]/route.ts
//
// 管理者向け: 自社銀行振込レビュー詳細取得 API。
// 一覧から個別レコードを開いたときの詳細モーダル用に、関連 purchase_request と
// 申告ユーザー、レビュー実施管理者（reviewed_by）の表示用情報を JOIN して返す。

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { createApiRoute } from "@/lib/routeFactory";
import { db } from "@/lib/drizzle";
import { getRoleCategory } from "@/features/core/user/constants";
import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/bank-transfer-reviews/[id]",
    operationType: "read",
  },
  async (_req, { params, session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 },
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { message: "レビュー ID が指定されていません。" },
        { status: 400 },
      );
    }

    // reviewed_by 用の UserTable は申告ユーザー (user_id) と区別するためエイリアスで JOIN
    const reviewerTable = alias(UserTable, "reviewer");

    const rows = await db
      .select({
        review: BankTransferReviewTable,
        purchaseRequest: PurchaseRequestTable,
        user: {
          id: UserTable.id,
          name: UserTable.name,
          email: UserTable.email,
        },
        reviewer: {
          id: reviewerTable.id,
          name: reviewerTable.name,
          email: reviewerTable.email,
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
      .leftJoin(
        reviewerTable,
        eq(BankTransferReviewTable.reviewed_by, reviewerTable.id),
      )
      .where(eq(BankTransferReviewTable.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        { message: "レビューが見つかりません。" },
        { status: 404 },
      );
    }

    return row;
  },
);
