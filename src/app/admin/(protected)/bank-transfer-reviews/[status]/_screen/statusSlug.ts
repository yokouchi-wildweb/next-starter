// src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/statusSlug.ts
//
// スラッグと status の対応表はドメインへ移した(@/features/core/bankTransferReview の STATUS_SLUG_BY_VALUE・
// STATUS_VALUE_BY_SLUG、constants/statusSlug.ts)。ここは今までの import 先を壊さないための再 export。
// 新しく書く物はドメインから import する(_screen は上流専用で、約束の外)。

export { STATUS_SLUG_BY_VALUE, STATUS_VALUE_BY_SLUG } from "@/features/core/bankTransferReview/constants/statusSlug";
