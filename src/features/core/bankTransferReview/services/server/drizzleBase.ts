// src/features/core/bankTransferReview/services/server/drizzleBase.ts

import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import {
  BankTransferReviewCreateSchema,
  BankTransferReviewUpdateSchema,
} from "@/features/bankTransferReview/entities/schema";
import { storageBindingFor } from "@/features/core/storageObject/services/server/crudBinding";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { z } from "zod";

const baseOptions = {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultSearchFields: ["user_id", "purchase_request_id", "status"],
  defaultOrderBy: [["submitted_at", "DESC"]],
} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof BankTransferReviewCreateSchema>
>;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定する。
// completePurchase / failPurchase との連動などドメイン固有のロジックは
// services/server/wrappers/ 以下にラップを作成して差し替えること。

// 振込明細画像（ref）をファイル台帳に紐付ける。紐付けは「アップロードした本人」かつ
// 「アップロード時の scopeId（purchase_request.id）がこの行の purchase_request_id と同じ」ときだけ通る
// （他人の画像・別の依頼の画像の流用を防ぐ。旧 validateProofImageUrl の役割）
export const storageBinding = storageBindingFor("bankTransferReview", [
  {
    name: "proof_image_url",
    purpose: "purchaseRequest.bankProof",
    multi: false,
    scope: (row) => String(row.purchase_request_id),
  },
]);

export const base = createCrudService(BankTransferReviewTable, {
  ...baseOptions,
  storage: storageBinding,
  parseCreate: (data) => BankTransferReviewCreateSchema.parse(data),
  parseUpdate: (data) => BankTransferReviewUpdateSchema.parse(data),
  parseUpsert: (data) => BankTransferReviewCreateSchema.parse(data),
});
