// src/app/api/admin/bank-transfer-reviews/bulk/send-email/route.ts
//
// 管理者向け: 振込レビュー一覧のバルクアクション「メール一斉送信」API。
// 選択されたレビューに紐づくユーザーへメールを一斉送信し、任意でサービス内
// お知らせ通知も発行する。詳細は wrappers/bulkSendEmail.tsx を参照。
//
// POST /api/admin/bank-transfer-reviews/bulk/send-email

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";

const BodySchema = z
  .object({
    ids: z
      .array(z.string().min(1))
      .min(1, { message: "対象の振込レビューを1件以上選択してください。" }),
    emailSubject: z.string().trim().min(1, { message: "メール件名は必須です。" }),
    emailBody: z.string().trim().min(1, { message: "メール本文は必須です。" }),
    sendNotification: z.boolean(),
    notificationTitle: z.string().optional(),
    notificationBody: z.string().optional(),
    /** 二重送信防止用の冪等性キー（クライアント発行、crypto.randomUUID()） */
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .refine(
    (v) =>
      !v.sendNotification ||
      (Boolean(v.notificationTitle?.trim()) &&
        Boolean(v.notificationBody?.trim())),
    { message: "通知タイトル・本文は必須です。" },
  );

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/bank-transfer-reviews/bulk/send-email",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 },
      );
    }

    let body: z.infer<typeof BodySchema>;
    try {
      const json = await req.json();
      const parsed = BodySchema.safeParse(json);
      if (!parsed.success) {
        const message = parsed.error.errors[0]?.message ?? "入力値が不正です。";
        return NextResponse.json({ message }, { status: 400 });
      }
      body = parsed.data;
    } catch {
      return NextResponse.json(
        { message: "リクエストボディの解析に失敗しました。" },
        { status: 400 },
      );
    }

    const result = await bankTransferReviewService.bulkSendEmail({
      reviewIds: body.ids,
      emailSubject: body.emailSubject,
      emailBody: body.emailBody,
      sendNotification: body.sendNotification,
      notificationTitle: body.sendNotification
        ? body.notificationTitle?.trim()
        : undefined,
      notificationBody: body.sendNotification
        ? body.notificationBody?.trim()
        : undefined,
      idempotencyKey: body.idempotencyKey,
    });

    return {
      success: true,
      ...result,
    };
  },
);
