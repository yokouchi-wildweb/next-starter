// src/features/core/bankTransferReview/entities/form.ts

import { z } from "zod";

import {
  BankTransferReviewCreateSchema,
  BankTransferReviewUpdateSchema,
} from "./schema";

export type BankTransferReviewCreateAdditional = {
  // フォームに追加する項目があればここに定義
};
export type BankTransferReviewCreateFields = z.infer<
  typeof BankTransferReviewCreateSchema
> &
  BankTransferReviewCreateAdditional;

export type BankTransferReviewUpdateAdditional = {
  // フォームに追加する項目があればここに定義
};
export type BankTransferReviewUpdateFields = z.infer<
  typeof BankTransferReviewUpdateSchema
> &
  BankTransferReviewUpdateAdditional;
